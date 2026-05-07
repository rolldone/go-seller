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

// CreateCustomerWithPassword inserts a new customer record with a hashed password.
func (s *AuthService) CreateCustomerWithPassword(ctx context.Context, customer *authmodels.Customer, password string) error {
	if customer == nil {
		return errors.New("customer is required")
	}
	customer.Name = strings.TrimSpace(customer.Name)
	customer.Email = strings.ToLower(strings.TrimSpace(customer.Email))
	if customer.Name == "" || customer.Email == "" || strings.TrimSpace(password) == "" {
		return errors.New("name, email, and password are required")
	}

	locale, err := normalizeCustomerLocale(customer.Locale)
	if err != nil {
		return err
	}
	customer.Locale = locale

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	hash := string(hashed)
	customer.PasswordHash = &hash
	if customer.IsActive {
		if customer.IsActivatedAt == nil {
			now := time.Now()
			customer.IsActivatedAt = &now
		}
	} else {
		customer.IsActivatedAt = nil
	}
	return s.DB.WithContext(ctx).Create(customer).Error
}

// GetCustomerByEmail returns a customer by email.
func (s *AuthService) GetCustomerByEmail(ctx context.Context, email string) (*authmodels.Customer, error) {
	var customer authmodels.Customer
	if err := s.DB.WithContext(ctx).Where("email = ?", strings.ToLower(strings.TrimSpace(email))).First(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

// AuthenticateCustomer validates customer credentials and account status.
func (s *AuthService) AuthenticateCustomer(ctx context.Context, email, password string) (*authmodels.Customer, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || password == "" {
		return nil, errors.New("email and password are required")
	}

	customer, err := s.GetCustomerByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if !customer.IsActive {
		return nil, errors.New("customer email is not verified")
	}
	if customer.IsBanned {
		if customer.BannedUntil == nil || customer.BannedUntil.After(time.Now()) {
			return nil, errors.New("customer is banned")
		}
	}
	if customer.PasswordHash == nil || strings.TrimSpace(*customer.PasswordHash) == "" {
		return nil, errors.New("invalid email or password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*customer.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid email or password")
	}
	return customer, nil
}

// IssueCustomerAccessToken signs a short-lived JWT token for authenticated customer.
func (s *AuthService) IssueCustomerAccessToken(customer *authmodels.Customer) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(
		customer.ID,
		"customer",
		time.Duration(internalauth.AccessExpirySeconds())*time.Second,
	)
}

// GenerateCustomerPasswordResetToken returns a stateless reset token with short TTL.
func (s *AuthService) GenerateCustomerPasswordResetToken(customerID string) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(customerID, "customer_password_reset", 15*time.Minute)
}

// GenerateCustomerEmailVerificationToken returns a short-lived token for customer email verification.
func (s *AuthService) GenerateCustomerEmailVerificationToken(customerID string) (string, time.Time, error) {
	return internalauth.GenerateAccessTokenWithLevel(customerID, "customer_email_verify", 24*time.Hour)
}

// VerifyCustomerEmailWithToken activates a customer account from a verification token.
func (s *AuthService) VerifyCustomerEmailWithToken(ctx context.Context, token string) error {
	claims, err := internalauth.ParseAccessTokenClaims(token)
	if err != nil {
		return err
	}
	if claims.Level != "customer_email_verify" {
		return errors.New("invalid verification token")
	}
	return s.UpdateCustomerByID(ctx, claims.AdminID, nil, nil, nil, nil, nil, boolPtr(true))
}

// ResetCustomerPasswordWithToken parses reset token and updates target customer password.
func (s *AuthService) ResetCustomerPasswordWithToken(ctx context.Context, token, newPassword string) error {
	claims, err := internalauth.ParseAccessTokenClaims(token)
	if err != nil {
		return err
	}
	if claims.Level != "customer_password_reset" {
		return errors.New("invalid reset token")
	}
	return s.UpdateCustomerPasswordByID(ctx, claims.AdminID, newPassword)
}

func boolPtr(value bool) *bool {
	return &value
}

// UpdateCustomerPasswordByID hashes and updates password by customer id.
func (s *AuthService) UpdateCustomerPasswordByID(ctx context.Context, id, newPassword string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	hash := string(hashed)
	res := s.DB.WithContext(ctx).Model(&authmodels.Customer{}).Where("id = ?", id).Updates(map[string]interface{}{
		"password":   hash,
		"updated_at": time.Now(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
