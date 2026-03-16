package services

import (
	"context"
	"strings"
	"time"

	authmodels "go_framework/plugins/auth/models"
)

type ListUsersFilter struct {
	Query       string
	IsActive    *bool
	IsBanned    *bool
	WithDeleted bool
	Page        int
	Limit       int
}

func (s *AuthService) CreateUser(ctx context.Context, user *authmodels.User) error {
	return s.DB.WithContext(ctx).Create(user).Error
}

func (s *AuthService) GetUserByID(ctx context.Context, id string) (*authmodels.User, error) {
	var user authmodels.User
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) ListUsers(ctx context.Context, f ListUsersFilter) ([]authmodels.User, int64, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Limit > 100 {
		f.Limit = 100
	}

	db := s.DB.WithContext(ctx)
	if f.WithDeleted {
		db = db.Unscoped()
	}
	q := db.Model(&authmodels.User{})
	if strings.TrimSpace(f.Query) != "" {
		like := "%" + strings.TrimSpace(f.Query) + "%"
		q = q.Where("full_name ILIKE ? OR email ILIKE ? OR phone_number ILIKE ?", like, like, like)
	}
	if f.IsActive != nil {
		q = q.Where("is_active = ?", *f.IsActive)
	}
	if f.IsBanned != nil {
		q = q.Where("is_banned = ?", *f.IsBanned)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []authmodels.User
	err := q.Order("created_at DESC").Offset((f.Page - 1) * f.Limit).Limit(f.Limit).Find(&rows).Error
	return rows, total, err
}

func (s *AuthService) UpdateUserByID(ctx context.Context, id string, fullName *string, email *string, phoneNumber *string, isActive *bool) error {
	updates := map[string]interface{}{"updated_at": time.Now()}
	if fullName != nil {
		updates["full_name"] = strings.TrimSpace(*fullName)
	}
	if email != nil {
		updates["email"] = strings.TrimSpace(strings.ToLower(*email))
	}
	if phoneNumber != nil {
		updates["phone_number"] = strings.TrimSpace(*phoneNumber)
	}
	if isActive != nil {
		updates["is_active"] = *isActive
	}

	return s.DB.WithContext(ctx).Model(&authmodels.User{}).Where("id = ?", id).Updates(updates).Error
}

func (s *AuthService) DeleteUserByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&authmodels.User{})
	return res.RowsAffected, res.Error
}

func (s *AuthService) RestoreUserByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.User{}).Unscoped().Where("id = ?", id).Updates(map[string]interface{}{
		"deleted_at": nil,
		"updated_at": time.Now(),
	})
	return res.RowsAffected, res.Error
}

func (s *AuthService) BanUserByID(ctx context.Context, id, reason string, until *time.Time, bannedBy *string) (int64, error) {
	now := time.Now()
	updates := map[string]interface{}{
		"is_banned":    true,
		"banned_at":    now,
		"banned_until": until,
		"ban_reason":   nil,
		"banned_by":    bannedBy,
		"updated_at":   now,
	}
	if strings.TrimSpace(reason) != "" {
		updates["ban_reason"] = strings.TrimSpace(reason)
	}

	res := s.DB.WithContext(ctx).Model(&authmodels.User{}).Where("id = ?", id).Updates(updates)
	return res.RowsAffected, res.Error
}

func (s *AuthService) UnbanUserByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_banned":    false,
		"banned_at":    nil,
		"banned_until": nil,
		"ban_reason":   nil,
		"banned_by":    nil,
		"updated_at":   time.Now(),
	})
	return res.RowsAffected, res.Error
}
