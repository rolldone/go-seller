package services

import (
	"context"
	"errors"
	"strings"
	"time"

	authmodels "go_framework/plugins/auth/models"
)

// ListCustomersFilter contains the optional filters for listing customers.
type ListCustomersFilter struct {
	Query       string
	Email       string
	IsActive    *bool
	IsBanned    *bool
	WithDeleted bool
	Page        int
	Limit       int
}

func normalizeCustomerLocale(locale string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(locale))
	if value == "" {
		return "id", nil
	}
	switch value {
	case "id", "en":
		return value, nil
	default:
		return "", errors.New("locale must be one of: id, en")
	}
}

// CreateCustomer inserts a new customer record.
func (s *AuthService) CreateCustomer(ctx context.Context, c *authmodels.Customer) error {
	locale, err := normalizeCustomerLocale(c.Locale)
	if err != nil {
		return err
	}
	c.Locale = locale
	return s.DB.WithContext(ctx).Create(c).Error
}

// GetCustomerByID retrieves a customer by its ID.
func (s *AuthService) GetCustomerByID(ctx context.Context, id string) (*authmodels.Customer, error) {
	var customer authmodels.Customer
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

// ListCustomers returns customers with pagination and optional filters.
func (s *AuthService) ListCustomers(ctx context.Context, f ListCustomersFilter) ([]authmodels.Customer, int64, error) {
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
	q := db.Model(&authmodels.Customer{})
	if searchTerm := strings.TrimSpace(f.Query); searchTerm != "" {
		like := "%" + searchTerm + "%"
		q = q.Where("name ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR id = ?", like, like, like, searchTerm)
	}
	if email := strings.TrimSpace(f.Email); email != "" {
		q = q.Where("email = ?", strings.ToLower(email))
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

	var rows []authmodels.Customer
	err := q.Order("created_at DESC").Offset((f.Page - 1) * f.Limit).Limit(f.Limit).Find(&rows).Error
	return rows, total, err
}

// UpdateCustomerByID updates the modifiable customer fields.
func (s *AuthService) UpdateCustomerByID(ctx context.Context, id string, name, email, phone, notes, locale *string, isActive *bool) error {
	updates := map[string]interface{}{"updated_at": time.Now()}
	if name != nil {
		updates["name"] = strings.TrimSpace(*name)
	}
	if email != nil {
		updates["email"] = strings.ToLower(strings.TrimSpace(*email))
	}
	if phone != nil {
		updates["phone"] = strings.TrimSpace(*phone)
	}
	if notes != nil {
		updates["notes"] = strings.TrimSpace(*notes)
	}
	if locale != nil {
		normalized, err := normalizeCustomerLocale(*locale)
		if err != nil {
			return err
		}
		updates["locale"] = normalized
	}
	if isActive != nil {
		updates["is_active"] = *isActive
	}

	return s.DB.WithContext(ctx).Model(&authmodels.Customer{}).Where("id = ?", id).Updates(updates).Error
}

// DeleteCustomerByID soft deletes a customer record.
func (s *AuthService) DeleteCustomerByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&authmodels.Customer{})
	return res.RowsAffected, res.Error
}

// RestoreCustomerByID undeletes a soft-deleted customer.
func (s *AuthService) RestoreCustomerByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.Customer{}).Unscoped().Where("id = ?", id).Updates(map[string]interface{}{
		"deleted_at": nil,
		"updated_at": time.Now(),
	})
	return res.RowsAffected, res.Error
}

// BanCustomerByID flags a customer as banned.
func (s *AuthService) BanCustomerByID(ctx context.Context, id, reason string, until *time.Time, bannedBy *string) (int64, error) {
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

	res := s.DB.WithContext(ctx).Model(&authmodels.Customer{}).Where("id = ?", id).Updates(updates)
	return res.RowsAffected, res.Error
}

// UnbanCustomerByID removes ban flags from a customer.
func (s *AuthService) UnbanCustomerByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&authmodels.Customer{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_banned":    false,
		"banned_at":    nil,
		"banned_until": nil,
		"ban_reason":   nil,
		"banned_by":    nil,
		"updated_at":   time.Now(),
	})
	return res.RowsAffected, res.Error
}
