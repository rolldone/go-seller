package services

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	catalogmodels "go_framework/plugins/catalog/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type MemberSetupInput struct {
	FullName     string
	Email        string
	Password     string
	PhoneNumber  string
	BusinessName string
	BusinessSlug string
}

type MemberSetupResult struct {
	User       *authmodels.User
	Business   *catalogmodels.Business
	Membership *catalogmodels.BusinessMember
}

func (s *AuthService) SetupMemberWithBusiness(ctx context.Context, in MemberSetupInput) (*MemberSetupResult, error) {
	fullName := strings.TrimSpace(in.FullName)
	email := strings.ToLower(strings.TrimSpace(in.Email))
	password := strings.TrimSpace(in.Password)
	phoneNumber := strings.TrimSpace(in.PhoneNumber)
	businessName := strings.TrimSpace(in.BusinessName)
	businessSlug := strings.TrimSpace(in.BusinessSlug)

	if fullName == "" || email == "" || password == "" || businessName == "" {
		return nil, errors.New("full_name, email, password, and business_name are required")
	}
	if businessSlug == "" {
		businessSlug = businessName
	}
	var slugErr error
	businessSlug, slugErr = s.ensureUniqueMemberBusinessSlug(ctx, businessSlug)
	if slugErr != nil {
		return nil, slugErr
	}
	if businessSlug == "" {
		return nil, errors.New("business_slug is required")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	passwordHash := string(hashedPassword)

	userID, err := uuid.New()
	if err != nil {
		return nil, err
	}
	businessID, err := uuid.New()
	if err != nil {
		return nil, err
	}
	membershipID, err := uuid.New()
	if err != nil {
		return nil, err
	}

	ownerRole := "Owner"
	now := time.Now()
	verificationToken, _, err := s.GenerateMemberEmailVerificationToken(userID)
	if err != nil {
		return nil, err
	}
	activationURL := buildMemberVerificationURL(verificationToken)
	user := &authmodels.User{
		ID:            userID,
		FullName:      fullName,
		Email:         email,
		PasswordHash:  &passwordHash,
		PhoneNumber:   phoneNumber,
		IsActive:      false,
		IsActivatedAt: nil,
	}
	business := &catalogmodels.Business{
		ID:        businessID,
		Name:      businessName,
		Slug:      businessSlug,
		OwnerName: &fullName,
		OwnerRole: &ownerRole,
	}
	membership := &catalogmodels.BusinessMember{
		ID:              membershipID,
		BusinessID:      businessID,
		UserID:          userID,
		IsOwner:         true,
		Role:            &ownerRole,
		Status:          "active",
		StatusChangedAt: &now,
	}

	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		if err := tx.Create(business).Error; err != nil {
			return err
		}
		if err := tx.Create(membership).Error; err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertBusiness(ctx, tx, business.ID)
	})
	if err != nil {
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, "member_setup_failed_admin", s.buildMemberSetupNotificationPayload(user, business, membership, "", "failed", err.Error()))
		return nil, err
	}

	pluginregistry.SendTemplateEventAsync(ctx, s.DB, "member_setup_admin", s.buildMemberSetupNotificationPayload(user, business, membership, activationURL, "pending_verification", "member created successfully"))
	pluginregistry.SendTemplateEventAsync(ctx, s.DB, "member_setup_member", s.buildMemberSetupNotificationPayload(user, business, membership, activationURL, "pending_verification", "member created successfully"))

	return &MemberSetupResult{User: user, Business: business, Membership: membership}, nil
}

func (s *AuthService) SetupMemberFromTeamInvite(ctx context.Context, token, fullName, password, phoneNumber string) (*MemberSetupResult, error) {
	claims, err := ParseTeamInviteClaims(token)
	if err != nil {
		return nil, err
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	businessID := strings.TrimSpace(claims.BusinessID)
	if email == "" || businessID == "" {
		return nil, errors.New("invalid invite token")
	}
	if strings.TrimSpace(fullName) == "" || strings.TrimSpace(password) == "" {
		return nil, errors.New("full_name and password are required")
	}
	if existing, err := s.GetUserByEmail(ctx, email); err == nil && existing != nil {
		return nil, errors.New("member account already exists")
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var business catalogmodels.Business
	if err := s.DB.WithContext(ctx).Where("id = ?", businessID).First(&business).Error; err != nil {
		return nil, err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(password)), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	passwordHash := string(hashedPassword)
	userID, err := uuid.New()
	if err != nil {
		return nil, err
	}
	membershipID, err := uuid.New()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	user := &authmodels.User{
		ID:           userID,
		FullName:     strings.TrimSpace(fullName),
		Email:        email,
		PasswordHash: &passwordHash,
		PhoneNumber:  strings.TrimSpace(phoneNumber),
		IsActive:     false,
	}
	membership := &catalogmodels.BusinessMember{
		ID:              membershipID,
		BusinessID:      businessID,
		UserID:          userID,
		IsOwner:         false,
		Role:            stringPtrOrNil(strings.TrimSpace(claims.Role)),
		Status:          "active",
		InvitedAt:       &now,
		StatusChangedAt: &now,
		InvitedBy:       stringPtrOrNil(strings.TrimSpace(claims.InvitedBy)),
	}

	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		if err := tx.Create(membership).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	verificationToken, _, err := s.GenerateMemberEmailVerificationToken(userID)
	if err != nil {
		return nil, err
	}
	activationURL := buildMemberVerificationURL(verificationToken)
	pluginregistry.SendTemplateEventAsync(ctx, s.DB, "member_setup_member", s.buildMemberSetupNotificationPayload(user, &business, membership, activationURL, "pending_verification", "member created from team invite"))

	return &MemberSetupResult{User: user, Business: &business, Membership: membership}, nil
}

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

func makeMemberBusinessSlug(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = nonSlugChars.ReplaceAllString(slug, "-")
	return strings.Trim(slug, "-")
}

func (s *AuthService) ensureUniqueMemberBusinessSlug(ctx context.Context, raw string) (string, error) {
	base := makeMemberBusinessSlug(raw)
	if base == "" {
		return "", errors.New("business_slug is required")
	}

	candidate := base
	for i := 0; i < 100; i++ {
		var count int64
		if err := s.DB.WithContext(ctx).
			Model(&catalogmodels.Business{}).
			Where("slug = ?", candidate).
			Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, i+2)
	}

	return "", fmt.Errorf("unable to generate unique business slug for %q", raw)
}

func (s *AuthService) buildMemberSetupNotificationPayload(user *authmodels.User, business *catalogmodels.Business, membership *catalogmodels.BusinessMember, activationURL string, setupStatus string, setupMessage string) map[string]interface{} {
	return map[string]interface{}{
		"member_id":       valueOrEmptyString(user, func(row *authmodels.User) string { return row.ID }),
		"member_email":    valueOrEmptyString(user, func(row *authmodels.User) string { return row.Email }),
		"full_name":       valueOrEmptyString(user, func(row *authmodels.User) string { return row.FullName }),
		"business_id":     valueOrEmptyString(business, func(row *catalogmodels.Business) string { return row.ID }),
		"business_name":   valueOrEmptyString(business, func(row *catalogmodels.Business) string { return row.Name }),
		"business_slug":   valueOrEmptyString(business, func(row *catalogmodels.Business) string { return row.Slug }),
		"membership_id":   valueOrEmptyString(membership, func(row *catalogmodels.BusinessMember) string { return row.ID }),
		"login_url":       buildMemberAuthURL(),
		"activation_url":  activationURL,
		"setup_status":    setupStatus,
		"setup_message":   setupMessage,
		"customer_locale": "id",
		"app_name":        getMemberSetupAppName(),
	}
}

func buildMemberAuthURL() string {
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
	return base + "/member/auth/login"
}

func buildMemberVerificationURL(token string) string {
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
	return base + "/member/auth/verify?token=" + url.QueryEscape(token)
}

func getMemberSetupAppName() string {
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

func stringPtrOrNil(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func valueOrEmptyString[T any](value *T, getter func(*T) string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(getter(value))
}
