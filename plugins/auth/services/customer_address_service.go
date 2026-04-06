package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"

	"gorm.io/gorm"
)

type CustomerAddressInput struct {
	Label        string
	ReceiverName string
	PhoneNumber  string
	AddressLine1 string
	AddressLine2 *string
	Subdistrict  *string
	District     *string
	City         string
	Province     string
	PostalCode   string
	Country      string
	Notes        *string
	IsPrimary    bool
	Metadata     map[string]any
}

func trimPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeCustomerAddressInput(input CustomerAddressInput) (CustomerAddressInput, []byte, error) {
	input.Label = strings.TrimSpace(input.Label)
	input.ReceiverName = strings.TrimSpace(input.ReceiverName)
	input.PhoneNumber = strings.TrimSpace(input.PhoneNumber)
	input.AddressLine1 = strings.TrimSpace(input.AddressLine1)
	input.AddressLine2 = trimPtr(input.AddressLine2)
	input.Subdistrict = trimPtr(input.Subdistrict)
	input.District = trimPtr(input.District)
	input.City = strings.TrimSpace(input.City)
	input.Province = strings.TrimSpace(input.Province)
	input.PostalCode = strings.TrimSpace(input.PostalCode)
	input.Country = strings.ToUpper(strings.TrimSpace(input.Country))
	input.Notes = trimPtr(input.Notes)
	if input.Country == "" {
		input.Country = "ID"
	}
	if input.ReceiverName == "" || input.PhoneNumber == "" || input.AddressLine1 == "" || input.City == "" || input.Province == "" || input.PostalCode == "" {
		return input, nil, errors.New("receiver_name, phone_number, address_line_1, city, province, and postal_code are required")
	}
	var metadataJSON []byte
	if input.Metadata != nil {
		buf, err := json.Marshal(input.Metadata)
		if err != nil {
			return input, nil, err
		}
		metadataJSON = buf
	}
	return input, metadataJSON, nil
}

func (s *AuthService) ListCustomerAddresses(ctx context.Context, customerID string) ([]authmodels.CustomerAddress, error) {
	var items []authmodels.CustomerAddress
	err := s.DB.WithContext(ctx).
		Where("customer_id = ?", strings.TrimSpace(customerID)).
		Order("is_primary DESC, updated_at DESC, created_at DESC").
		Find(&items).Error
	return items, err
}

func (s *AuthService) GetCustomerAddressByID(ctx context.Context, customerID, addressID string) (*authmodels.CustomerAddress, error) {
	var item authmodels.CustomerAddress
	if err := s.DB.WithContext(ctx).
		Where("id = ? AND customer_id = ?", strings.TrimSpace(addressID), strings.TrimSpace(customerID)).
		First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *AuthService) GetPrimaryCustomerAddress(ctx context.Context, customerID string) (*authmodels.CustomerAddress, error) {
	var item authmodels.CustomerAddress
	err := s.DB.WithContext(ctx).
		Where("customer_id = ? AND is_primary = ?", strings.TrimSpace(customerID), true).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *AuthService) CreateCustomerAddress(ctx context.Context, customerID string, input CustomerAddressInput) (*authmodels.CustomerAddress, error) {
	customerID = strings.TrimSpace(customerID)
	if customerID == "" {
		return nil, errors.New("customer_id is required")
	}
	input, metadataJSON, err := normalizeCustomerAddressInput(input)
	if err != nil {
		return nil, err
	}
	var created authmodels.CustomerAddress
	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&authmodels.CustomerAddress{}).Where("customer_id = ?", customerID).Count(&count).Error; err != nil {
			return err
		}
		isPrimary := input.IsPrimary || count == 0
		if isPrimary {
			if err := tx.Model(&authmodels.CustomerAddress{}).Where("customer_id = ?", customerID).Updates(map[string]any{"is_primary": false, "updated_at": time.Now()}).Error; err != nil {
				return err
			}
		}
		created = authmodels.CustomerAddress{
			ID:           uuid.NewString(),
			CustomerID:   customerID,
			Label:        input.Label,
			ReceiverName: input.ReceiverName,
			PhoneNumber:  input.PhoneNumber,
			AddressLine1: input.AddressLine1,
			AddressLine2: input.AddressLine2,
			Subdistrict:  input.Subdistrict,
			District:     input.District,
			City:         input.City,
			Province:     input.Province,
			PostalCode:   input.PostalCode,
			Country:      input.Country,
			Notes:        input.Notes,
			IsPrimary:    isPrimary,
			Metadata:     metadataJSON,
		}
		return tx.Create(&created).Error
	})
	if err != nil {
		return nil, err
	}
	return &created, nil
}

func (s *AuthService) UpdateCustomerAddress(ctx context.Context, customerID, addressID string, input CustomerAddressInput) (*authmodels.CustomerAddress, error) {
	customerID = strings.TrimSpace(customerID)
	addressID = strings.TrimSpace(addressID)
	input, metadataJSON, err := normalizeCustomerAddressInput(input)
	if err != nil {
		return nil, err
	}
	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current authmodels.CustomerAddress
		if err := tx.Where("id = ? AND customer_id = ?", addressID, customerID).First(&current).Error; err != nil {
			return err
		}
		if input.IsPrimary {
			if err := tx.Model(&authmodels.CustomerAddress{}).Where("customer_id = ?", customerID).Updates(map[string]any{"is_primary": false, "updated_at": time.Now()}).Error; err != nil {
				return err
			}
		}
		updates := map[string]any{
			"label":          input.Label,
			"receiver_name":  input.ReceiverName,
			"phone_number":   input.PhoneNumber,
			"address_line_1": input.AddressLine1,
			"address_line_2": input.AddressLine2,
			"subdistrict":    input.Subdistrict,
			"district":       input.District,
			"city":           input.City,
			"province":       input.Province,
			"postal_code":    input.PostalCode,
			"country":        input.Country,
			"notes":          input.Notes,
			"is_primary":     input.IsPrimary || current.IsPrimary,
			"metadata":       metadataJSON,
			"updated_at":     time.Now(),
		}
		return tx.Model(&authmodels.CustomerAddress{}).Where("id = ? AND customer_id = ?", addressID, customerID).Updates(updates).Error
	})
	if err != nil {
		return nil, err
	}
	return s.GetCustomerAddressByID(ctx, customerID, addressID)
}

func (s *AuthService) SetPrimaryCustomerAddress(ctx context.Context, customerID, addressID string) (*authmodels.CustomerAddress, error) {
	customerID = strings.TrimSpace(customerID)
	addressID = strings.TrimSpace(addressID)
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current authmodels.CustomerAddress
		if err := tx.Where("id = ? AND customer_id = ?", addressID, customerID).First(&current).Error; err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&authmodels.CustomerAddress{}).Where("customer_id = ?", customerID).Updates(map[string]any{"is_primary": false, "updated_at": now}).Error; err != nil {
			return err
		}
		return tx.Model(&authmodels.CustomerAddress{}).Where("id = ? AND customer_id = ?", addressID, customerID).Updates(map[string]any{"is_primary": true, "updated_at": now}).Error
	})
	if err != nil {
		return nil, err
	}
	return s.GetCustomerAddressByID(ctx, customerID, addressID)
}

func (s *AuthService) DeleteCustomerAddress(ctx context.Context, customerID, addressID string) (int64, error) {
	customerID = strings.TrimSpace(customerID)
	addressID = strings.TrimSpace(addressID)
	var deleted authmodels.CustomerAddress
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND customer_id = ?", addressID, customerID).First(&deleted).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ? AND customer_id = ?", addressID, customerID).Delete(&authmodels.CustomerAddress{}).Error; err != nil {
			return err
		}
		if deleted.IsPrimary {
			var replacement authmodels.CustomerAddress
			if err := tx.Where("customer_id = ?", customerID).Order("updated_at DESC, created_at DESC").First(&replacement).Error; err == nil {
				return tx.Model(&authmodels.CustomerAddress{}).Where("id = ?", replacement.ID).Updates(map[string]any{"is_primary": true, "updated_at": time.Now()}).Error
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return 1, nil
}
