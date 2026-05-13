package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go_framework/plugins/order/models"

	"gorm.io/gorm"
)

type NotificationGroupService struct {
	DB *gorm.DB
}

func NewNotificationGroupService(db *gorm.DB) *NotificationGroupService {
	return &NotificationGroupService{DB: db}
}

// ValidNotificationEvents contains the event keys that can be subscribed to.
var ValidNotificationEvents = []string{
	"withdrawal_requested",
	"withdrawal_approved",
	"withdrawal_rejected",
	"withdrawal_processed",
	"complaint_reminder_business",
	"settlement_held",
	"settlement_partially_released",
	"settlement_released",
	"settlement_refunded",
	"order_created",
	"payment_succeeded",
	"payment_failed",
	"order_dispute_opened",
	"order_dispute_seller_won",
	"order_dispute_customer_won",
	"order_dispute_refunded",
}

type CreateNotificationGroupInput struct {
	Name       string   `json:"name"`
	Email      string   `json:"email"`
	MemberIDs  []string `json:"member_ids"`
	EventTypes []string `json:"event_types"`
}

type UpdateNotificationGroupInput struct {
	Name       *string  `json:"name"`
	Email      *string  `json:"email"`
	MemberIDs  []string `json:"member_ids"`
	EventTypes []string `json:"event_types"`
	IsActive   *bool    `json:"is_active"`
}

func normalizeEventTypes(eventTypes []string) string {
	var cleaned []string
	for _, ev := range eventTypes {
		ev = strings.TrimSpace(ev)
		if ev != "" {
			cleaned = append(cleaned, ev)
		}
	}
	return strings.Join(cleaned, ",")
}

func normalizeStringIDs(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	ids := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		ids = append(ids, trimmed)
	}
	return ids
}

func (s *NotificationGroupService) ListGroups(ctx context.Context, businessID string) ([]models.MemberNotificationGroup, error) {
	var groups []models.MemberNotificationGroup
	if err := s.DB.WithContext(ctx).
		Preload("Members.User").
		Where("business_id = ?", businessID).
		Order("created_at ASC").
		Find(&groups).Error; err != nil {
		return nil, err
	}
	return groups, nil
}

func (s *NotificationGroupService) GetGroup(ctx context.Context, id int64, businessID string) (*models.MemberNotificationGroup, error) {
	var g models.MemberNotificationGroup
	if err := s.DB.WithContext(ctx).
		Preload("Members.User").
		Where("id = ? AND business_id = ?", id, businessID).
		First(&g).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("notification group not found")
		}
		return nil, err
	}
	return &g, nil
}

func (s *NotificationGroupService) resolveMemberIDsByEmail(ctx context.Context, businessID string, email string) ([]string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, nil
	}
	var ids []string
	if err := s.DB.WithContext(ctx).
		Table("business_members bm").
		Joins("JOIN users u ON u.id = bm.user_id AND u.deleted_at IS NULL").
		Where("bm.business_id = ? AND bm.deleted_at IS NULL AND COALESCE(NULLIF(bm.status, ''), 'active') = ? AND LOWER(u.email) = ?", businessID, "active", email).
		Distinct().
		Pluck("bm.user_id", &ids).Error; err != nil {
		return nil, err
	}
	return normalizeStringIDs(ids), nil
}

func (s *NotificationGroupService) validateBusinessMemberIDs(ctx context.Context, businessID string, memberIDs []string) ([]string, error) {
	memberIDs = normalizeStringIDs(memberIDs)
	if len(memberIDs) == 0 {
		return nil, nil
	}
	var validIDs []string
	if err := s.DB.WithContext(ctx).
		Table("business_members").
		Where("business_id = ? AND deleted_at IS NULL AND COALESCE(NULLIF(status, ''), 'active') = ? AND user_id IN ?", businessID, "active", memberIDs).
		Distinct().
		Pluck("user_id", &validIDs).Error; err != nil {
		return nil, err
	}
	validIDs = normalizeStringIDs(validIDs)
	if len(validIDs) != len(memberIDs) {
		validSet := make(map[string]struct{}, len(validIDs))
		for _, id := range validIDs {
			validSet[id] = struct{}{}
		}
		invalid := make([]string, 0)
		for _, id := range memberIDs {
			if _, ok := validSet[id]; !ok {
				invalid = append(invalid, id)
			}
		}
		return nil, fmt.Errorf("some member_ids are not active members of this business: %s", strings.Join(invalid, ", "))
	}
	return validIDs, nil
}

func (s *NotificationGroupService) syncGroupMembers(ctx context.Context, tx *gorm.DB, groupID int64, businessID string, memberIDs []string, legacyEmail *string) error {
	if err := tx.Where("group_id = ?", groupID).Delete(&models.MemberNotificationGroupMember{}).Error; err != nil {
		return err
	}

	resolvedIDs, err := s.validateBusinessMemberIDs(ctx, businessID, memberIDs)
	if err != nil {
		return err
	}
	if len(resolvedIDs) == 0 && legacyEmail != nil {
		resolvedIDs, err = s.resolveMemberIDsByEmail(ctx, businessID, *legacyEmail)
		if err != nil {
			return err
		}
	}
	if len(resolvedIDs) == 0 {
		return nil
	}

	now := time.Now()
	rows := make([]models.MemberNotificationGroupMember, 0, len(resolvedIDs))
	for _, userID := range resolvedIDs {
		rows = append(rows, models.MemberNotificationGroupMember{
			GroupID:   groupID,
			UserID:    userID,
			CreatedAt: now,
		})
	}
	return tx.Create(&rows).Error
}

func (s *NotificationGroupService) CreateGroup(ctx context.Context, businessID string, in CreateNotificationGroupInput) (*models.MemberNotificationGroup, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, errors.New("name is required")
	}

	now := time.Now()
	legacyEmail := strings.ToLower(strings.TrimSpace(in.Email))
	g := &models.MemberNotificationGroup{
		BusinessID: businessID,
		Name:       strings.TrimSpace(in.Name),
		EventTypes: normalizeEventTypes(in.EventTypes),
		IsActive:   true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(g).Error; err != nil {
			return err
		}
		return s.syncGroupMembers(ctx, tx, g.ID, businessID, in.MemberIDs, &legacyEmail)
	}); err != nil {
		return nil, err
	}
	createdGroup, err := s.GetGroup(ctx, g.ID, businessID)
	if err != nil {
		return nil, err
	}
	return createdGroup, nil
}

func (s *NotificationGroupService) UpdateGroup(ctx context.Context, id int64, businessID string, in UpdateNotificationGroupInput) (*models.MemberNotificationGroup, error) {
	g, err := s.GetGroup(ctx, id, businessID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{"updated_at": time.Now()}
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		updates["name"] = strings.TrimSpace(*in.Name)
	}
	var legacyEmail *string
	if in.Email != nil {
		trimmed := strings.ToLower(strings.TrimSpace(*in.Email))
		legacyEmail = &trimmed
	}
	if in.EventTypes != nil {
		updates["event_types"] = normalizeEventTypes(in.EventTypes)
	}
	if in.IsActive != nil {
		updates["is_active"] = *in.IsActive
	}

	if err := s.DB.WithContext(ctx).Model(g).Updates(updates).Error; err != nil {
		return nil, err
	}
	if in.MemberIDs != nil || legacyEmail != nil {
		if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			return s.syncGroupMembers(ctx, tx, g.ID, businessID, in.MemberIDs, legacyEmail)
		}); err != nil {
			return nil, err
		}
		updatedGroup, err := s.GetGroup(ctx, id, businessID)
		if err != nil {
			return nil, err
		}
		g = updatedGroup
	}
	return g, nil
}

func (s *NotificationGroupService) DeleteGroup(ctx context.Context, id int64, businessID string) error {
	result := s.DB.WithContext(ctx).
		Where("id = ? AND business_id = ?", id, businessID).
		Delete(&models.MemberNotificationGroup{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("notification group not found")
	}
	return nil
}

// GetActiveGroupsForEvent returns all active groups for a business that match a given event key.
func (s *NotificationGroupService) GetActiveGroupsForEvent(ctx context.Context, businessID string, eventKey string) ([]models.MemberNotificationGroup, error) {
	var groups []models.MemberNotificationGroup
	if err := s.DB.WithContext(ctx).
		Preload("Members.User").
		Where("business_id = ? AND is_active = true", businessID).
		Find(&groups).Error; err != nil {
		return nil, err
	}

	var matched []models.MemberNotificationGroup
	for _, g := range groups {
		if g.MatchesEvent(eventKey) {
			matched = append(matched, g)
		}
	}
	return matched, nil
}
