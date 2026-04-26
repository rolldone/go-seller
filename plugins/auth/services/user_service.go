package services

import (
	"context"
	"errors"
	"strings"
	"time"

	internalauth "go_framework/internal/auth"
	authmodels "go_framework/plugins/auth/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
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

// GetUserByEmail returns a user by email.
func (s *AuthService) GetUserByEmail(ctx context.Context, email string) (*authmodels.User, error) {
	var user authmodels.User
	if err := s.DB.WithContext(ctx).Where("email = ?", strings.ToLower(strings.TrimSpace(email))).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// AuthenticateUser validates member credentials and account status.
func (s *AuthService) AuthenticateUser(ctx context.Context, email, password string) (*authmodels.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || password == "" {
		return nil, errors.New("email and password are required")
	}

	user, err := s.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if !user.IsActive || user.IsActivatedAt == nil {
		return nil, errors.New("member email is not verified")
	}
	if user.IsBanned {
		return nil, errors.New("user is banned")
	}
	if user.PasswordHash == nil || strings.TrimSpace(*user.PasswordHash) == "" {
		return nil, errors.New("invalid email or password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid email or password")
	}
	return user, nil
}

// IssueMemberAccessToken signs a short-lived JWT token for authenticated member users.
func (s *AuthService) IssueMemberAccessToken(user *authmodels.User) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(
		user.ID,
		"member",
		time.Duration(internalauth.AccessExpirySeconds())*time.Second,
	)
}

// GenerateMemberEmailVerificationToken returns a short-lived token for email verification.
func (s *AuthService) GenerateMemberEmailVerificationToken(memberID string) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(memberID, "member_email_verify", 24*time.Hour)
}

// GenerateMemberPasswordResetToken returns a short-lived token for member password reset.
func (s *AuthService) GenerateMemberPasswordResetToken(memberID string) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(memberID, "member_password_reset", 15*time.Minute)
}

// VerifyMemberEmailWithToken activates a member account from a verification token.
func (s *AuthService) VerifyMemberEmailWithToken(ctx context.Context, token string) error {
	claims, err := internalauth.ParseAccessTokenClaims(token)
	if err != nil {
		return err
	}
	if claims.Level != "member_email_verify" {
		return errors.New("invalid verification token")
	}
	return s.ActivateUserByID(ctx, claims.AdminID)
}

// ResetMemberPasswordWithToken parses reset token and updates target member password.
func (s *AuthService) ResetMemberPasswordWithToken(ctx context.Context, token, newPassword string) error {
	claims, err := internalauth.ParseAccessTokenClaims(token)
	if err != nil {
		return err
	}
	if claims.Level != "member_password_reset" {
		return errors.New("invalid reset token")
	}
	return s.UpdateUserPasswordByID(ctx, claims.AdminID, newPassword)
}

// ActivateUserByID marks a member account active and sets its activation timestamp.
func (s *AuthService) ActivateUserByID(ctx context.Context, id string) error {
	now := time.Now()
	res := s.DB.WithContext(ctx).Model(&authmodels.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_active":       true,
		"is_activated_at": now,
		"updated_at":      now,
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// UpdateUserPasswordByID hashes and updates password hash by member id.
func (s *AuthService) UpdateUserPasswordByID(ctx context.Context, id, newPassword string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	hash := string(hashed)
	res := s.DB.WithContext(ctx).Model(&authmodels.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"password_hash": hash,
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
