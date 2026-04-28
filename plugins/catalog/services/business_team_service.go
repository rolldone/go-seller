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
	businessMemberRoleFulfillment = "fulfillment"
	businessMemberRoleFinance     = "finance"
	businessMemberRoleCS          = "cs"
)

var allowedBusinessMemberRoles = map[string]string{
	businessMemberRoleFulfillment: "Tim Fulfillment",
	businessMemberRoleFinance:     "Tim Finance",
	businessMemberRoleCS:          "Tim CS",
}

var ErrBusinessTeamInviteSetupRequired = errors.New("member setup required")

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

func normalizeBusinessMemberRole(role string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(role))
	if normalized == "" {
		return "", errors.New("role is required")
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

func (s *CatalogService) ListBusinessMembers(ctx context.Context, ownerID, businessID string, status string, page, limit int) ([]catalogmodels.BusinessMember, int64, error) {
	if _, err := s.GetBusinessByIDForMemberOwner(ctx, ownerID, businessID); err != nil {
		return nil, 0, err
	}
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
	status, _ := normalizeBusinessMemberStatus(businessMemberStatusInvited)
	roleValue, err := normalizeBusinessMemberRole(role)
	if err != nil {
		return nil, err
	}
	inviteMemberName := inviteEmail
	if targetUser, err := s.getUserByEmail(ctx, inviteEmail); err == nil {
		inviteMemberName = strings.TrimSpace(targetUser.FullName)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if token, _, err := authservices.GenerateTeamInviteToken(strings.TrimSpace(business.ID), 24*time.Hour, authservices.TeamInviteClaims{
		Email:      inviteEmail,
		BusinessID: strings.TrimSpace(business.ID),
		Role:       roleValue,
		InvitedBy:  strings.TrimSpace(inviter.ID),
	}); err == nil {
		payload := map[string]interface{}{
			"member_name":      inviteMemberName,
			"member_email":     inviteEmail,
			"business_id":      strings.TrimSpace(business.ID),
			"business_name":    strings.TrimSpace(business.Name),
			"business_slug":    strings.TrimSpace(business.Slug),
			"role":             roleValue,
			"status":           status,
			"invited_by_id":    strings.TrimSpace(inviter.ID),
			"invited_by_name":  strings.TrimSpace(inviter.FullName),
			"invited_by_email": strings.TrimSpace(inviter.Email),
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
	var inviter authmodels.User
	if inviterID := strings.TrimSpace(claims.InvitedBy); inviterID != "" {
		_ = s.DB.WithContext(ctx).Where("id = ?", inviterID).First(&inviter).Error
	}
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
		InviterName:   strings.TrimSpace(inviter.FullName),
		InviterEmail:  strings.TrimSpace(inviter.Email),
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
	member, err := s.upsertInviteMembership(ctx, businessID, user.ID, claims.Role, claims.InvitedBy)
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
	roleValue, err := normalizeBusinessMemberRole(role)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	status, _ := normalizeBusinessMemberStatus(businessMemberStatusActive)
	if status == "" {
		status = businessMemberStatusActive
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
			member.Role = nullableString(roleValue)
			member.Status = status
			member.InvitedAt = &now
			member.StatusChangedAt = &now
			member.SuspendedAt = nil
			member.SuspensionReason = nil
			member.InvitedBy = nullableString(invitedBy)
			member.DeletedAt = gorm.DeletedAt{}
			if err := tx.Unscoped().Model(&member).Updates(map[string]interface{}{
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
			IsOwner:         false,
			Role:            nullableString(roleValue),
			Status:          status,
			InvitedAt:       &now,
			StatusChangedAt: &now,
			InvitedBy:       nullableString(invitedBy),
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
		return tx.Model(&catalogmodels.BusinessMember{}).
			Where("business_id = ? AND id = ?", strings.TrimSpace(businessID), strings.TrimSpace(memberID)).
			Updates(updates).Error
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
	return s.DB.WithContext(ctx).Delete(member).Error
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
	now := time.Now()
	if err := s.DB.WithContext(ctx).Model(&catalogmodels.BusinessMember{}).
		Where("business_id = ? AND id = ?", strings.TrimSpace(businessID), strings.TrimSpace(memberID)).
		Updates(map[string]interface{}{
			"role":       nullableString(roleValue),
			"updated_at": now,
		}).Error; err != nil {
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
