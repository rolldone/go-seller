package services

import (
	"context"
	"errors"
	"strings"
	"time"

	internalauth "go_framework/internal/auth"

	"golang.org/x/crypto/bcrypt"

	authmodels "go_framework/plugins/auth/models"

	"gorm.io/gorm"
)

type ListAdminsFilter struct {
	Query    string
	IsBanned *bool
	Page     int
	Limit    int
}

// CreateAdmin creates a new admin record with given fields.
func (s *AuthService) CreateAdmin(ctx context.Context, admin *authmodels.Admin) error {
	return s.DB.WithContext(ctx).Create(admin).Error
}

// AuthenticateAdmin validates admin credentials and account status.
func (s *AuthService) AuthenticateAdmin(ctx context.Context, email, password string) (*authmodels.Admin, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || password == "" {
		return nil, errors.New("email and password are required")
	}

	admin, err := s.GetAdminByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if admin.IsActivatedAt == nil {
		return nil, errors.New("admin is not activated")
	}
	if admin.IsBanned {
		if admin.BannedUntil == nil || admin.BannedUntil.After(time.Now()) {
			return nil, errors.New("admin is banned")
		}
	}
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid email or password")
	}
	return admin, nil
}

// IssueAccessToken signs a short-lived JWT token for authenticated admin.
func (s *AuthService) IssueAccessToken(admin *authmodels.Admin) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(
		admin.ID,
		"admin",
		time.Duration(internalauth.AccessExpirySeconds())*time.Second,
	)
}

// GeneratePasswordResetToken returns a stateless reset token with short TTL.
func (s *AuthService) GeneratePasswordResetToken(adminID string) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(adminID, "password_reset", 15*time.Minute)
}

// ResetPasswordWithToken parses reset token and updates target admin password.
func (s *AuthService) ResetPasswordWithToken(ctx context.Context, token, newPassword string) error {
	claims, err := internalauth.ParseAccessTokenClaims(token)
	if err != nil {
		return err
	}
	if claims.Level != "password_reset" {
		return errors.New("invalid reset token")
	}
	return s.UpdatePasswordByID(ctx, claims.AdminID, newPassword)
}

// GetAdminByEmail returns an admin by email.
func (s *AuthService) GetAdminByEmail(ctx context.Context, email string) (*authmodels.Admin, error) {
	var a authmodels.Admin
	if err := s.DB.WithContext(ctx).Where("email = ?", email).First(&a).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

// GetAdminByID returns an admin by id.
func (s *AuthService) GetAdminByID(ctx context.Context, id string) (*authmodels.Admin, error) {
	var a authmodels.Admin
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&a).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAdmins lists admins with basic search and pagination.
func (s *AuthService) ListAdmins(ctx context.Context, f ListAdminsFilter) ([]authmodels.Admin, int64, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Limit > 100 {
		f.Limit = 100
	}

	q := s.DB.WithContext(ctx).Model(&authmodels.Admin{})
	if strings.TrimSpace(f.Query) != "" {
		like := "%" + strings.TrimSpace(f.Query) + "%"
		q = q.Where("username ILIKE ? OR email ILIKE ?", like, like)
	}
	if f.IsBanned != nil {
		q = q.Where("is_banned = ?", *f.IsBanned)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []authmodels.Admin
	err := q.Order("created_at DESC").Offset((f.Page - 1) * f.Limit).Limit(f.Limit).Find(&rows).Error
	return rows, total, err
}

// ListRolesForAdmins returns a mapping admin_id -> []Role for given admin IDs.
func (s *AuthService) ListRolesForAdmins(ctx context.Context, adminIDs []string) (map[string][]authmodels.Role, error) {
	if len(adminIDs) == 0 {
		return map[string][]authmodels.Role{}, nil
	}

	type row struct {
		AdminID   string    `gorm:"column:admin_id"`
		RoleID    string    `gorm:"column:role_id"`
		Name      string    `gorm:"column:name"`
		Desc      *string   `gorm:"column:description"`
		IsSys     bool      `gorm:"column:is_system"`
		CreatedAt time.Time `gorm:"column:created_at"`
		UpdatedAt time.Time `gorm:"column:updated_at"`
	}

	var rows []row
	q := s.DB.WithContext(ctx).Table("admin_roles").Select("admin_roles.admin_id, roles.id as role_id, roles.name, roles.description, roles.is_system, roles.created_at, roles.updated_at").Joins("join roles on roles.id = admin_roles.role_id").Where("admin_roles.admin_id IN ?", adminIDs)
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}

	m := make(map[string][]authmodels.Role)
	for _, r := range rows {
		ro := authmodels.Role{
			ID:          r.RoleID,
			Name:        r.Name,
			Description: r.Desc,
			IsSystem:    r.IsSys,
			CreatedAt:   r.CreatedAt,
			UpdatedAt:   r.UpdatedAt,
		}
		m[r.AdminID] = append(m[r.AdminID], ro)
	}
	return m, nil
}

// UpdateAdminByID updates mutable admin profile fields.
func (s *AuthService) UpdateAdminByID(ctx context.Context, id string, username *string, email *string) error {
	updates := map[string]interface{}{"updated_at": time.Now()}
	if username != nil {
		updates["username"] = strings.TrimSpace(*username)
	}
	if email != nil {
		updates["email"] = strings.TrimSpace(strings.ToLower(*email))
	}
	return s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Where("id = ?", id).Updates(updates).Error
}

// DeleteAdminByID soft-deletes an admin by id.
func (s *AuthService) DeleteAdminByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&authmodels.Admin{})
	return res.RowsAffected, res.Error
}

// RestoreAdminByID clears deleted_at to restore a soft-deleted admin.
func (s *AuthService) RestoreAdminByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Unscoped().Where("id = ?", id).Updates(map[string]interface{}{
		"deleted_at": nil,
		"updated_at": time.Now(),
	})
	return res.RowsAffected, res.Error
}

// DeleteAdminByEmail deletes an admin record by email. Returns number of rows affected and error.
func (s *AuthService) DeleteAdminByEmail(ctx context.Context, email string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("email = ?", email).Delete(&authmodels.Admin{})
	return res.RowsAffected, res.Error
}

// RestoreAdminByEmail clears deleted_at to restore a soft-deleted admin.
func (s *AuthService) RestoreAdminByEmail(ctx context.Context, email string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Unscoped().Where("email = ?", email).Updates(map[string]interface{}{
		"deleted_at": nil,
		"updated_at": time.Now(),
	})
	return res.RowsAffected, res.Error
}

// ActivateAdminByEmail sets is_activated_at to now for the admin with given email.
func (s *AuthService) ActivateAdminByEmail(ctx context.Context, email string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Where("email = ?", email).Updates(map[string]interface{}{
		"is_activated_at": time.Now(),
		"updated_at":      time.Now(),
	})
	return res.RowsAffected, res.Error
}

// DeactivateAdminByEmail clears is_activated_at for the admin with given email.
func (s *AuthService) DeactivateAdminByEmail(ctx context.Context, email string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Where("email = ?", email).Updates(map[string]interface{}{
		"is_activated_at": nil,
		"updated_at":      time.Now(),
	})
	return res.RowsAffected, res.Error
}

// UpdatePasswordByEmail hashes the new password and updates the admin's password_hash.
func (s *AuthService) UpdatePasswordByEmail(ctx context.Context, email, newPassword string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Where("email = ?", email).Updates(map[string]interface{}{
		"password_hash": string(hashed),
		"updated_at":    time.Now(),
	}).Error
}

// UpdatePasswordByID hashes and updates password_hash by admin id.
func (s *AuthService) UpdatePasswordByID(ctx context.Context, id, newPassword string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	res := s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Where("id = ?", id).Updates(map[string]interface{}{
		"password_hash": string(hashed),
		"updated_at":    time.Now(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// BanAdminByEmail sets rich ban metadata for admin account.
func (s *AuthService) BanAdminByEmail(ctx context.Context, email, reason string, until *time.Time, bannedBy *string) (int64, error) {
	now := time.Now()
	updates := map[string]interface{}{
		"is_banned":    true,
		"banned_at":    now,
		"banned_until": until,
		"ban_reason":   nil,
		"banned_by":    bannedBy,
		"updated_at":   now,
	}
	if reason != "" {
		updates["ban_reason"] = reason
	}
	res := s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Where("email = ?", email).Updates(updates)
	return res.RowsAffected, res.Error
}

// UnbanAdminByEmail clears rich ban metadata for admin account.
func (s *AuthService) UnbanAdminByEmail(ctx context.Context, email string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.Admin{}).Where("email = ?", email).Updates(map[string]interface{}{
		"is_banned":    false,
		"banned_at":    nil,
		"banned_until": nil,
		"ban_reason":   nil,
		"banned_by":    nil,
		"updated_at":   time.Now(),
	})
	return res.RowsAffected, res.Error
}
