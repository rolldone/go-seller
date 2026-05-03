package services

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	internalauth "go_framework/internal/auth"
	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	authservices "go_framework/plugins/auth/services"
	catalogmodels "go_framework/plugins/catalog/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

const (
	businessMemberStatusActive    = "active"
	businessMemberStatusInvited   = "invited"
	businessMemberStatusSuspended = "suspended"
	businessMemberRoleOwner       = "owner"
	businessMemberRoleFulfillment = "fulfillment"
	businessMemberRoleFinance     = "finance"
	businessMemberRoleCS          = "cs"
)

var businessMemberRoleLabels = map[string]string{
	businessMemberRoleOwner:       "Owner",
	businessMemberRoleFulfillment: "Tim Fulfillment",
	businessMemberRoleFinance:     "Tim Finance",
	businessMemberRoleCS:          "Tim CS",
}

var allowedBusinessMemberRoles = map[string]string{
	businessMemberRoleFulfillment: "Tim Fulfillment",
	businessMemberRoleFinance:     "Tim Finance",
	businessMemberRoleCS:          "Tim CS",
}

var ErrBusinessTeamInviteSetupRequired = errors.New("member setup required")

type BusinessTeamInviteRoleOption struct {
	Value       string `json:"value"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
}

type BusinessTeamInviteContext struct {
	BusinessID   string                         `json:"business_id"`
	BusinessName string                         `json:"business_name"`
	BusinessSlug string                         `json:"business_slug"`
	HasOwner     bool                           `json:"has_owner"`
	RoleOptions  []BusinessTeamInviteRoleOption `json:"role_options"`
}

type BusinessMemberCandidate struct {
	ID          string    `json:"id"`
	FullName    string    `json:"full_name"`
	Email       string    `json:"email"`
	PhoneNumber string    `json:"phone_number,omitempty"`
	IsActive    bool      `json:"is_active"`
	IsBanned    bool      `json:"is_banned"`
	CreatedAt   time.Time `json:"created_at"`
}

type TeamInviteResolution struct {
	Email         string `json:"email"`
	BusinessID    string `json:"business_id"`
	BusinessName  string `json:"business_name"`
	BusinessSlug  string `json:"business_slug"`
	Role          string `json:"role"`
	InviterName   string `json:"inviter_name"`
	InviterEmail  string `json:"inviter_email"`
	AccountExists bool   `json:"account_exists"`
	RequiresSetup bool   `json:"requires_setup"`
}

func normalizeBusinessMemberStatus(status string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(status))
	if normalized == "" || normalized == "all" {
		return "", nil
	}
	switch normalized {
	case businessMemberStatusActive, businessMemberStatusInvited, businessMemberStatusSuspended:
		return normalized, nil
	default:
		return "", fmt.Errorf("invalid member status %q", status)
	}
}

func stringPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func (s *CatalogService) resolveBusinessMemberInvitedBy(ctx context.Context, invitedBy string) (*string, error) {
	trimmedInvitedBy := strings.TrimSpace(invitedBy)
	if trimmedInvitedBy == "" {
		return nil, nil
	}
	if _, err := s.getUserByID(ctx, trimmedInvitedBy); err == nil {
		return nullableString(trimmedInvitedBy), nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return nil, nil
}

func (s *CatalogService) resolveInviteSenderIdentity(ctx context.Context, inviterID string) (string, string) {
	trimmedInviterID := strings.TrimSpace(inviterID)
	if trimmedInviterID == "" {
		return "", ""
	}
	if user, err := s.getUserByID(ctx, trimmedInviterID); err == nil {
		return strings.TrimSpace(user.FullName), strings.TrimSpace(user.Email)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ""
	}
	var admin authmodels.Admin
	if err := s.DB.WithContext(ctx).Where("id = ?", trimmedInviterID).First(&admin).Error; err != nil {
		return "", ""
	}
	return strings.TrimSpace(admin.Username), strings.TrimSpace(admin.Email)
}

func normalizeBusinessMemberRole(role string) (string, error) {
	return normalizeBusinessMemberInviteRole(role, false)
}

func normalizeBusinessMemberInviteRole(role string, allowOwner bool) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(role))
	if normalized == "" {
		return "", errors.New("role is required")
	}
	if allowOwner && normalized == businessMemberRoleOwner {
		return normalized, nil
	}
	if _, ok := allowedBusinessMemberRoles[normalized]; !ok {
		return "", fmt.Errorf("invalid role %q", role)
	}
	return normalized, nil
}

func (s *CatalogService) getUserByEmail(ctx context.Context, email string) (*authmodels.User, error) {
	var user authmodels.User
	if err := s.DB.WithContext(ctx).Where("email = ?", strings.ToLower(strings.TrimSpace(email))).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *CatalogService) getUserByID(ctx context.Context, id string) (*authmodels.User, error) {
	var user authmodels.User
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *CatalogService) getAdminByID(ctx context.Context, id string) (*authmodels.Admin, error) {
	var admin authmodels.Admin
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&admin).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

func (s *CatalogService) businessHasOwner(ctx context.Context, businessID string) (bool, error) {
	var count int64
	if err := s.DB.WithContext(ctx).
		Model(&catalogmodels.BusinessMember{}).
		Where("business_id = ? AND is_owner = TRUE AND deleted_at IS NULL", strings.TrimSpace(businessID)).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *CatalogService) buildBusinessInviteRoleOptions(hasOwner bool) []BusinessTeamInviteRoleOption {
	options := []BusinessTeamInviteRoleOption{
		{Value: businessMemberRoleFulfillment, Label: businessMemberRoleLabels[businessMemberRoleFulfillment], Description: "Mengurus packing, gudang, dan pengiriman."},
		{Value: businessMemberRoleFinance, Label: businessMemberRoleLabels[businessMemberRoleFinance], Description: "Mengurus pembayaran, laporan, dan pencairan dana."},
		{Value: businessMemberRoleCS, Label: businessMemberRoleLabels[businessMemberRoleCS], Description: "Mengurus koordinasi customer dan operasional komunikasi."},
	}
	if !hasOwner {
		options = append([]BusinessTeamInviteRoleOption{{Value: businessMemberRoleOwner, Label: businessMemberRoleLabels[businessMemberRoleOwner], Description: "Dipakai untuk owner pertama pada business ini."}}, options...)
	}
	return options
}

func (s *CatalogService) GetBusinessTeamInviteContext(ctx context.Context, businessID string) (*BusinessTeamInviteContext, error) {
	var business catalogmodels.Business
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(businessID)).First(&business).Error; err != nil {
		return nil, err
	}
	hasOwner, err := s.businessHasOwner(ctx, business.ID)
	if err != nil {
		return nil, err
	}
	return &BusinessTeamInviteContext{
		BusinessID:   business.ID,
		BusinessName: strings.TrimSpace(business.Name),
		BusinessSlug: strings.TrimSpace(business.Slug),
		HasOwner:     hasOwner,
		RoleOptions:  s.buildBusinessInviteRoleOptions(hasOwner),
	}, nil
}

func (s *CatalogService) getBusinessMemberByID(ctx context.Context, businessID, memberID string) (*catalogmodels.BusinessMember, error) {
	var member catalogmodels.BusinessMember
	if err := s.DB.WithContext(ctx).
		Preload("User").
		Where("business_id = ? AND id = ?", strings.TrimSpace(businessID), strings.TrimSpace(memberID)).
		First(&member).Error; err != nil {
		return nil, err
	}
	return &member, nil
}

func (s *CatalogService) listBusinessMembersQuery(ctx context.Context, businessID string) *gorm.DB {
	return s.DB.WithContext(ctx).
		Model(&catalogmodels.BusinessMember{}).
		Preload("User").
		Where("business_id = ? AND deleted_at IS NULL", strings.TrimSpace(businessID))
}

func (s *CatalogService) listBusinessMembersPage(ctx context.Context, businessID, status string, page, limit int) ([]catalogmodels.BusinessMember, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := s.listBusinessMembersQuery(ctx, businessID)
	if normalized, err := normalizeBusinessMemberStatus(status); err != nil {
		return nil, 0, err
	} else if normalized != "" {
		query = query.Where("COALESCE(NULLIF(status, ''), 'active') = ?", normalized)
	}

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []catalogmodels.BusinessMember
	offset := (page - 1) * limit
	if err := query.Order("is_owner desc, created_at asc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) ListBusinessMembers(ctx context.Context, ownerID, businessID string, status string, page, limit int) ([]catalogmodels.BusinessMember, int64, error) {
	if _, err := s.GetBusinessByIDForMemberOwner(ctx, ownerID, businessID); err != nil {
		return nil, 0, err
	}
	return s.listBusinessMembersPage(ctx, businessID, status, page, limit)
}

func (s *CatalogService) ListBusinessMembersForAdmin(ctx context.Context, businessID, status string, page, limit int) ([]catalogmodels.BusinessMember, int64, error) {
	if _, err := s.GetBusinessByID(ctx, businessID); err != nil {
		return nil, 0, err
	}
	return s.listBusinessMembersPage(ctx, businessID, status, page, limit)
}

func (s *CatalogService) ListBusinessTeamAudits(ctx context.Context, businessID string, page, limit int) ([]catalogmodels.BusinessTeamAudit, int64, error) {
	if _, err := s.GetBusinessByID(ctx, businessID); err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := s.DB.WithContext(ctx).
		Model(&catalogmodels.BusinessTeamAudit{}).
		Where("business_id = ?", strings.TrimSpace(businessID))

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []catalogmodels.BusinessTeamAudit
	offset := (page - 1) * limit
	if err := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) appendBusinessTeamAudit(ctx context.Context, tx *gorm.DB, audit catalogmodels.BusinessTeamAudit) error {
	trimmedBusinessID := strings.TrimSpace(audit.BusinessID)
	if trimmedBusinessID == "" {
		return errors.New("business_id is required")
	}
	if strings.TrimSpace(audit.ActorType) == "" {
		return errors.New("actor_type is required")
	}
	if strings.TrimSpace(audit.Action) == "" {
		return errors.New("action is required")
	}
	audit.BusinessID = trimmedBusinessID
	id, err := uuid.New()
	if err != nil {
		return err
	}
	audit.ID = id
	db := s.DB
	if tx != nil {
		db = tx
	}
	return db.WithContext(ctx).Create(&audit).Error
}

func (s *CatalogService) SearchBusinessMemberCandidates(ctx context.Context, businessID, query string, page, limit int) ([]BusinessMemberCandidate, int64, error) {
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		return nil, 0, errors.New("business_id is required")
	}
	if _, err := s.GetBusinessByID(ctx, trimmedBusinessID); err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	q := s.DB.WithContext(ctx).Model(&authmodels.User{})
	if strings.TrimSpace(query) != "" {
		like := "%" + strings.TrimSpace(query) + "%"
		q = q.Where("full_name ILIKE ? OR email ILIKE ? OR phone_number ILIKE ?", like, like, like)
	}
	memberUserIDs := s.DB.WithContext(ctx).
		Model(&catalogmodels.BusinessMember{}).
		Select("user_id").
		Where("business_id = ? AND deleted_at IS NULL", trimmedBusinessID)
	q = q.Where("id NOT IN (?)", memberUserIDs)

	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []authmodels.User
	offset := (page - 1) * limit
	if err := q.Order("created_at desc").Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	rows := make([]BusinessMemberCandidate, 0, len(users))
	for _, user := range users {
		rows = append(rows, BusinessMemberCandidate{
			ID:          strings.TrimSpace(user.ID),
			FullName:    strings.TrimSpace(user.FullName),
			Email:       strings.TrimSpace(user.Email),
			PhoneNumber: strings.TrimSpace(user.PhoneNumber),
			IsActive:    user.IsActive,
			IsBanned:    user.IsBanned,
			CreatedAt:   user.CreatedAt,
		})
	}

	return rows, total, nil
}

func (s *CatalogService) InviteBusinessMember(ctx context.Context, ownerID, businessID, email, role string) (*catalogmodels.BusinessMember, error) {
	business, err := s.GetBusinessByIDForMemberOwner(ctx, ownerID, businessID)
	if err != nil {
		return nil, err
	}
	inviter, err := s.getUserByID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	inviteEmail := strings.ToLower(strings.TrimSpace(email))
	if inviteEmail == "" {
		return nil, errors.New("email is required")
	}
	targetUserID := ""
	status, _ := normalizeBusinessMemberStatus(businessMemberStatusInvited)
	roleValue, err := normalizeBusinessMemberInviteRole(role, false)
	if err != nil {
		return nil, err
	}
	inviteMemberName := inviteEmail
	if targetUser, err := s.getUserByEmail(ctx, inviteEmail); err == nil {
		inviteMemberName = strings.TrimSpace(targetUser.FullName)
		targetUserID = strings.TrimSpace(targetUser.ID)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	member, err := s.sendBusinessMemberInvite(ctx, business, strings.TrimSpace(inviter.ID), strings.TrimSpace(inviter.FullName), strings.TrimSpace(inviter.Email), "Owner", inviteEmail, inviteMemberName, roleValue, status)
	if err != nil {
		return nil, err
	}
	if err := s.appendBusinessTeamAudit(ctx, nil, catalogmodels.BusinessTeamAudit{
		BusinessID:   business.ID,
		ActorType:    catalogmodels.BusinessTeamAuditActorTypeMember,
		ActorID:      nullableString(strings.TrimSpace(inviter.ID)),
		Action:       catalogmodels.BusinessTeamAuditActionInvite,
		TargetUserID: nullableString(targetUserID),
		TargetEmail:  nullableString(inviteEmail),
		RoleTo:       nullableString(roleValue),
		StatusTo:     nullableString(status),
	}); err != nil {
		return nil, err
	}
	return member, nil
}

func (s *CatalogService) InviteBusinessMemberByAdmin(ctx context.Context, adminID, businessID, userID, email, role string) (*catalogmodels.BusinessMember, error) {
	business, err := s.GetBusinessByID(ctx, businessID)
	if err != nil {
		return nil, err
	}
	admin, err := s.getAdminByID(ctx, adminID)
	if err != nil {
		return nil, err
	}
	hasOwner, err := s.businessHasOwner(ctx, business.ID)
	if err != nil {
		return nil, err
	}
	roleValue, err := normalizeBusinessMemberInviteRole(role, !hasOwner)
	if err != nil {
		return nil, err
	}
	if roleValue == businessMemberRoleOwner && hasOwner {
		return nil, errors.New("owner already exists for this business")
	}
	inviteEmail := strings.ToLower(strings.TrimSpace(email))
	inviteMemberName := inviteEmail
	targetUserID := strings.TrimSpace(userID)
	if trimmedUserID := strings.TrimSpace(userID); trimmedUserID != "" {
		targetUser, err := s.getUserByID(ctx, trimmedUserID)
		if err != nil {
			return nil, err
		}
		inviteEmail = strings.ToLower(strings.TrimSpace(targetUser.Email))
		inviteMemberName = strings.TrimSpace(targetUser.FullName)
		targetUserID = strings.TrimSpace(targetUser.ID)
	} else {
		if inviteEmail == "" {
			return nil, errors.New("email is required")
		}
		if targetUser, err := s.getUserByEmail(ctx, inviteEmail); err == nil {
			inviteMemberName = strings.TrimSpace(targetUser.FullName)
			targetUserID = strings.TrimSpace(targetUser.ID)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	status, _ := normalizeBusinessMemberStatus(businessMemberStatusInvited)
	member, err := s.sendBusinessMemberInvite(ctx, business, strings.TrimSpace(admin.ID), strings.TrimSpace(admin.Username), strings.TrimSpace(admin.Email), "Admin", inviteEmail, inviteMemberName, roleValue, status)
	if err != nil {
		return nil, err
	}
	if err := s.appendBusinessTeamAudit(ctx, nil, catalogmodels.BusinessTeamAudit{
		BusinessID:   business.ID,
		ActorType:    catalogmodels.BusinessTeamAuditActorTypeAdmin,
		ActorID:      nullableString(strings.TrimSpace(admin.ID)),
		Action:       catalogmodels.BusinessTeamAuditActionInvite,
		TargetUserID: nullableString(targetUserID),
		TargetEmail:  nullableString(inviteEmail),
		RoleTo:       nullableString(roleValue),
		StatusTo:     nullableString(status),
	}); err != nil {
		return nil, err
	}
	return member, nil
}

func (s *CatalogService) sendBusinessMemberInvite(ctx context.Context, business *catalogmodels.Business, inviterID, inviterName, inviterEmail, inviterLabel, inviteEmail, inviteMemberName, roleValue, status string) (*catalogmodels.BusinessMember, error) {
	if business == nil {
		return nil, errors.New("business is required")
	}
	if inviteEmail == "" {
		return nil, errors.New("email is required")
	}
	if roleValue == "" {
		return nil, errors.New("role is required")
	}
	if status == "" {
		status = businessMemberStatusInvited
	}
	if token, _, err := authservices.GenerateTeamInviteToken(strings.TrimSpace(business.ID), 24*time.Hour, authservices.TeamInviteClaims{
		Email:      inviteEmail,
		BusinessID: strings.TrimSpace(business.ID),
		Role:       roleValue,
		InvitedBy:  strings.TrimSpace(inviterID),
	}); err == nil {
		payload := map[string]interface{}{
			"member_name":      inviteMemberName,
			"member_email":     inviteEmail,
			"business_id":      strings.TrimSpace(business.ID),
			"business_name":    strings.TrimSpace(business.Name),
			"business_slug":    strings.TrimSpace(business.Slug),
			"role":             roleValue,
			"status":           status,
			"invited_by_id":    strings.TrimSpace(inviterID),
			"invited_by_name":  strings.TrimSpace(inviterName),
			"invited_by_email": strings.TrimSpace(inviterEmail),
			"invited_by_label": strings.TrimSpace(inviterLabel),
			"invite_url":       buildTeamInviteURL(token),
			"app_name":         getTeamNotificationAppName(),
		}
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, "team_member_invited_member", payload)
	}
	return nil, nil
}

func (s *CatalogService) ResolveBusinessMemberInvite(ctx context.Context, token string) (*TeamInviteResolution, error) {
	claims, err := authservices.ParseTeamInviteClaims(token)
	if err != nil {
		return nil, err
	}
	inviteEmail := strings.ToLower(strings.TrimSpace(claims.Email))
	if inviteEmail == "" {
		return nil, errors.New("invalid invite token")
	}
	businessID := strings.TrimSpace(claims.BusinessID)
	if businessID == "" {
		businessID = strings.TrimSpace(claims.SubjectID)
	}
	if businessID == "" {
		return nil, errors.New("invalid invite token")
	}
	var business catalogmodels.Business
	if err := s.DB.WithContext(ctx).Where("id = ?", businessID).First(&business).Error; err != nil {
		return nil, err
	}
	inviterName, inviterEmail := s.resolveInviteSenderIdentity(ctx, claims.InvitedBy)
	_, err = s.getUserByEmail(ctx, inviteEmail)
	accountExists := err == nil
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return &TeamInviteResolution{
		Email:         inviteEmail,
		BusinessID:    business.ID,
		BusinessName:  strings.TrimSpace(business.Name),
		BusinessSlug:  strings.TrimSpace(business.Slug),
		Role:          strings.TrimSpace(claims.Role),
		InviterName:   inviterName,
		InviterEmail:  inviterEmail,
		AccountExists: accountExists,
		RequiresSetup: !accountExists,
	}, nil
}

func (s *CatalogService) AcceptBusinessMemberInvite(ctx context.Context, token string) (*catalogmodels.BusinessMember, error) {
	claims, err := authservices.ParseTeamInviteClaims(token)
	if err != nil {
		return nil, err
	}
	inviteEmail := strings.ToLower(strings.TrimSpace(claims.Email))
	businessID := strings.TrimSpace(claims.BusinessID)
	if inviteEmail == "" || businessID == "" {
		return nil, errors.New("invalid invite token")
	}
	user, err := s.getUserByEmail(ctx, inviteEmail)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBusinessTeamInviteSetupRequired
		}
		return nil, err
	}
	if user.IsBanned {
		return nil, errors.New("user is banned")
	}
	if strings.TrimSpace(user.ID) == "" {
		return nil, ErrBusinessTeamInviteSetupRequired
	}
	if err := s.DB.WithContext(ctx).Where("id = ?", businessID).First(&catalogmodels.Business{}).Error; err != nil {
		return nil, err
	}
	roleValue, err := normalizeBusinessMemberInviteRole(claims.Role, true)
	if err != nil {
		return nil, err
	}
	if roleValue == businessMemberRoleOwner {
		hasOwner, err := s.businessHasOwner(ctx, businessID)
		if err != nil {
			return nil, err
		}
		if hasOwner {
			return nil, errors.New("owner already exists for this business")
		}
	}
	member, err := s.upsertInviteMembership(ctx, businessID, user.ID, roleValue, claims.InvitedBy)
	if err != nil {
		return nil, err
	}

	if member.User == nil {
		member.User = user
	}
	return member, nil
}

func (s *CatalogService) upsertInviteMembership(ctx context.Context, businessID, userID, role, invitedBy string) (*catalogmodels.BusinessMember, error) {
	trimmedBusinessID := strings.TrimSpace(businessID)
	trimmedUserID := strings.TrimSpace(userID)
	if trimmedBusinessID == "" || trimmedUserID == "" {
		return nil, errors.New("invalid invite target")
	}
	roleValue, err := normalizeBusinessMemberInviteRole(role, true)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	status, _ := normalizeBusinessMemberStatus(businessMemberStatusActive)
	if status == "" {
		status = businessMemberStatusActive
	}
	resolvedInvitedBy, err := s.resolveBusinessMemberInvitedBy(ctx, invitedBy)
	if err != nil {
		return nil, err
	}
	var member catalogmodels.BusinessMember
	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		lookup := tx.Unscoped().Where("business_id = ? AND user_id = ?", trimmedBusinessID, trimmedUserID).First(&member)
		if lookup.Error != nil && !errors.Is(lookup.Error, gorm.ErrRecordNotFound) {
			return lookup.Error
		}
		if lookup.Error == nil {
			if member.IsOwner {
				return errors.New("owner member cannot accept invite")
			}
			member.IsOwner = roleValue == businessMemberRoleOwner
			member.Role = nullableString(roleValue)
			member.Status = status
			member.InvitedAt = &now
			member.StatusChangedAt = &now
			member.SuspendedAt = nil
			member.SuspensionReason = nil
			member.InvitedBy = resolvedInvitedBy
			member.DeletedAt = gorm.DeletedAt{}
			if err := tx.Unscoped().Model(&member).Updates(map[string]interface{}{
				"is_owner":          member.IsOwner,
				"role":              member.Role,
				"status":            member.Status,
				"invited_at":        member.InvitedAt,
				"status_changed_at": member.StatusChangedAt,
				"suspended_at":      nil,
				"suspension_reason": nil,
				"invited_by":        member.InvitedBy,
				"deleted_at":        nil,
				"updated_at":        now,
			}).Error; err != nil {
				return err
			}
			return nil
		}
		memberID, err := uuid.New()
		if err != nil {
			return err
		}
		member = catalogmodels.BusinessMember{
			ID:              memberID,
			BusinessID:      trimmedBusinessID,
			UserID:          trimmedUserID,
			IsOwner:         roleValue == businessMemberRoleOwner,
			Role:            nullableString(roleValue),
			Status:          status,
			InvitedAt:       &now,
			StatusChangedAt: &now,
			InvitedBy:       resolvedInvitedBy,
		}
		return tx.Create(&member).Error
	})
	if err != nil {
		return nil, err
	}

	if err := s.DB.WithContext(ctx).Preload("User").Where("business_id = ? AND user_id = ?", trimmedBusinessID, trimmedUserID).First(&member).Error; err != nil {
		return nil, err
	}
	if err := s.DB.WithContext(ctx).Model(&authmodels.User{}).Where("id = ?", trimmedUserID).Updates(map[string]interface{}{
		"is_active":       true,
		"is_activated_at": now,
		"updated_at":      now,
	}).Error; err != nil {
		return nil, err
	}
	return &member, nil
}

func (s *CatalogService) UpdateBusinessMemberStatus(ctx context.Context, ownerID, businessID, memberID, status, reason string) (*catalogmodels.BusinessMember, error) {
	business, err := s.GetBusinessByIDForMemberOwner(ctx, ownerID, businessID)
	if err != nil {
		return nil, err
	}
	inviter, err := s.getUserByID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	member, err := s.getBusinessMemberByID(ctx, businessID, memberID)
	if err != nil {
		return nil, err
	}
	if member.IsOwner {
		return nil, errors.New("owner member cannot be modified")
	}
	beforeStatus := strings.TrimSpace(member.Status)
	beforeRole := stringPtrValue(member.Role)
	normalizedStatus, err := normalizeBusinessMemberStatus(status)
	if err != nil {
		return nil, err
	}
	if normalizedStatus == "" {
		normalizedStatus = businessMemberStatusActive
	}
	now := time.Now()
	updates := map[string]interface{}{
		"status":            normalizedStatus,
		"status_changed_at": now,
		"updated_at":        now,
	}
	trimmedReason := strings.TrimSpace(reason)
	switch normalizedStatus {
	case businessMemberStatusSuspended:
		updates["suspended_at"] = now
		if trimmedReason != "" {
			updates["suspension_reason"] = trimmedReason
		} else {
			updates["suspension_reason"] = nil
		}
	case businessMemberStatusInvited:
		updates["invited_at"] = now
		updates["invited_by"] = &inviter.ID
		updates["suspended_at"] = nil
		updates["suspension_reason"] = nil
	default:
		updates["suspended_at"] = nil
		updates["suspension_reason"] = nil
	}
	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&catalogmodels.BusinessMember{}).
			Where("business_id = ? AND id = ?", strings.TrimSpace(businessID), strings.TrimSpace(memberID)).
			Updates(updates).Error; err != nil {
			return err
		}
		notes := strings.TrimSpace(reason)
		return s.appendBusinessTeamAudit(ctx, tx, catalogmodels.BusinessTeamAudit{
			BusinessID:       business.ID,
			BusinessMemberID: nullableString(strings.TrimSpace(member.ID)),
			TargetUserID:     nullableString(strings.TrimSpace(member.UserID)),
			ActorType:        catalogmodels.BusinessTeamAuditActorTypeMember,
			ActorID:          nullableString(strings.TrimSpace(inviter.ID)),
			Action:           catalogmodels.BusinessTeamAuditActionStatus,
			StatusFrom:       nullableString(beforeStatus),
			StatusTo:         nullableString(normalizedStatus),
			RoleFrom:         nullableString(beforeRole),
			RoleTo:           nullableString(stringPtrValue(member.Role)),
			Notes:            nullableString(notes),
		})
	}); err != nil {
		return nil, err
	}
	if err := s.DB.WithContext(ctx).
		Preload("User").
		Where("business_id = ? AND id = ?", strings.TrimSpace(businessID), strings.TrimSpace(memberID)).
		First(&member).Error; err != nil {
		return nil, err
	}
	if normalizedStatus == businessMemberStatusInvited || normalizedStatus == businessMemberStatusSuspended {
		s.dispatchTeamMemberNotification(ctx, business, inviter, member.User, member, normalizedStatus, trimmedReason)
	}
	return member, nil
}

func (s *CatalogService) DeleteBusinessMember(ctx context.Context, ownerID, businessID, memberID string) error {
	if _, err := s.GetBusinessByIDForMemberOwner(ctx, ownerID, businessID); err != nil {
		return err
	}
	member, err := s.getBusinessMemberByID(ctx, businessID, memberID)
	if err != nil {
		return err
	}
	if member.IsOwner {
		return errors.New("owner member cannot be removed")
	}
	beforeStatus := strings.TrimSpace(member.Status)
	beforeRole := stringPtrValue(member.Role)
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(member).Error; err != nil {
			return err
		}
		return s.appendBusinessTeamAudit(ctx, tx, catalogmodels.BusinessTeamAudit{
			BusinessID:       strings.TrimSpace(businessID),
			BusinessMemberID: nullableString(strings.TrimSpace(member.ID)),
			TargetUserID:     nullableString(strings.TrimSpace(member.UserID)),
			ActorType:        catalogmodels.BusinessTeamAuditActorTypeMember,
			ActorID:          nullableString(strings.TrimSpace(ownerID)),
			Action:           catalogmodels.BusinessTeamAuditActionRemove,
			StatusFrom:       nullableString(beforeStatus),
			StatusTo:         nullableString("deleted"),
			RoleFrom:         nullableString(beforeRole),
			RoleTo:           nullableString(beforeRole),
		})
	})
}

func (s *CatalogService) UpdateBusinessMemberRole(ctx context.Context, ownerID, businessID, memberID, role string) (*catalogmodels.BusinessMember, error) {
	if _, err := s.GetBusinessByIDForMemberOwner(ctx, ownerID, businessID); err != nil {
		return nil, err
	}
	member, err := s.getBusinessMemberByID(ctx, businessID, memberID)
	if err != nil {
		return nil, err
	}
	trimmedRole := strings.TrimSpace(role)
	if trimmedRole == "" {
		return nil, errors.New("role is required")
	}
	roleValue, err := normalizeBusinessMemberRole(trimmedRole)
	if err != nil {
		return nil, err
	}
	if member.IsOwner {
		return nil, errors.New("owner role cannot be changed")
	}
	beforeStatus := strings.TrimSpace(member.Status)
	beforeRole := stringPtrValue(member.Role)
	now := time.Now()
	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&catalogmodels.BusinessMember{}).
			Where("business_id = ? AND id = ?", strings.TrimSpace(businessID), strings.TrimSpace(memberID)).
			Updates(map[string]interface{}{
				"role":       nullableString(roleValue),
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
		return s.appendBusinessTeamAudit(ctx, tx, catalogmodels.BusinessTeamAudit{
			BusinessID:       strings.TrimSpace(businessID),
			BusinessMemberID: nullableString(strings.TrimSpace(member.ID)),
			TargetUserID:     nullableString(strings.TrimSpace(member.UserID)),
			ActorType:        catalogmodels.BusinessTeamAuditActorTypeMember,
			ActorID:          nullableString(strings.TrimSpace(ownerID)),
			Action:           catalogmodels.BusinessTeamAuditActionRole,
			StatusFrom:       nullableString(beforeStatus),
			StatusTo:         nullableString(beforeStatus),
			RoleFrom:         nullableString(beforeRole),
			RoleTo:           nullableString(roleValue),
		})
	}); err != nil {
		return nil, err
	}
	if err := s.DB.WithContext(ctx).
		Preload("User").
		Where("business_id = ? AND id = ?", strings.TrimSpace(businessID), strings.TrimSpace(memberID)).
		First(&member).Error; err != nil {
		return nil, err
	}
	return member, nil
}

func (s *CatalogService) dispatchTeamMemberNotification(ctx context.Context, business *catalogmodels.Business, inviter *authmodels.User, memberUser *authmodels.User, membership *catalogmodels.BusinessMember, status string, reason string) {
	if business == nil || inviter == nil || memberUser == nil || membership == nil {
		return
	}
	payload := map[string]interface{}{
		"member_id":        strings.TrimSpace(memberUser.ID),
		"member_name":      strings.TrimSpace(memberUser.FullName),
		"member_email":     strings.TrimSpace(memberUser.Email),
		"business_id":      strings.TrimSpace(business.ID),
		"business_name":    strings.TrimSpace(business.Name),
		"business_slug":    strings.TrimSpace(business.Slug),
		"membership_id":    strings.TrimSpace(membership.ID),
		"role":             stringPtrValue(membership.Role),
		"status":           strings.TrimSpace(status),
		"invited_by_id":    strings.TrimSpace(inviter.ID),
		"invited_by_name":  strings.TrimSpace(inviter.FullName),
		"invited_by_email": strings.TrimSpace(inviter.Email),
		"reason":           strings.TrimSpace(reason),
		"app_name":         getTeamNotificationAppName(),
	}
	switch strings.TrimSpace(status) {
	case businessMemberStatusInvited:
		if token, _, err := internalauth.GenerateAccessTokenWithLevel(strings.TrimSpace(membership.ID), "member_team_invite", 24*time.Hour); err == nil {
			payload["invite_url"] = buildTeamInviteURL(token)
		}
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, "team_member_invited_member", payload)
	case businessMemberStatusSuspended:
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, "team_member_suspended_member", payload)
	}
}

func buildTeamInviteURL(token string) string {
	base := strings.TrimRight(strings.TrimSpace(getEnvOrDefault("FRONT_URL", "")), "/")
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(getEnvOrDefault("PUBLIC_APP_URL", "")), "/")
	}
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(getEnvOrDefault("APP_URL", "")), "/")
	}
	if base == "" {
		base = "http://localhost:4321"
	}
	return base + "/member/auth/team-invite?token=" + url.QueryEscape(token)
}

func nullableString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func getTeamNotificationAppName() string {
	if value := strings.TrimSpace(getEnvOrDefault("APP_NAME", "")); value != "" {
		return value
	}
	if value := strings.TrimSpace(getEnvOrDefault("PUBLIC_APP_NAME", "")); value != "" {
		return value
	}
	return "Go Seller"
}

func getEnvOrDefault(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
