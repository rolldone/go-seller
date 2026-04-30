package services

import (
	"context"
	"strings"

	financemodels "go_framework/plugins/finance/models"

	"gorm.io/gorm"
)

// CreateBankAccount inserts a new bank account record.
func (s *FinanceService) CreateBankAccount(ctx context.Context, a *financemodels.BankAccount) error {
	return s.DB.WithContext(ctx).Create(a).Error
}

// ListBankAccountsForBusiness returns bank accounts for a business.
func (s *FinanceService) ListBankAccountsForBusiness(ctx context.Context, businessID string) ([]financemodels.BankAccount, error) {
	var out []financemodels.BankAccount
	if err := s.DB.WithContext(ctx).
		Where("business_id = ? AND deleted_at IS NULL", strings.TrimSpace(businessID)).
		Order("is_primary desc, created_at desc").
		Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// ListBankAccountsForMember returns bank accounts for all businesses the member belongs to.
func (s *FinanceService) ListBankAccountsForMember(ctx context.Context, memberID string) ([]financemodels.BankAccount, error) {
	// Reuse business list query via direct SQL join to business_members
	var businessIDs []string
	if err := s.DB.WithContext(ctx).
		Table("businesses").
		Joins("JOIN business_members ON business_members.business_id = businesses.id").
		Where("business_members.user_id = ? AND business_members.status = 'active'", strings.TrimSpace(memberID)).
		Distinct().Pluck("businesses.id", &businessIDs).Error; err != nil {
		return nil, err
	}
	if len(businessIDs) == 0 {
		return []financemodels.BankAccount{}, nil
	}
	var out []financemodels.BankAccount
	if err := s.DB.WithContext(ctx).
		Where("business_id IN ? AND deleted_at IS NULL", businessIDs).
		Order("business_id, is_primary desc, created_at desc").
		Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// GetBankAccountByID returns a bank account by id.
func (s *FinanceService) GetBankAccountByID(ctx context.Context, id string) (*financemodels.BankAccount, error) {
	var out financemodels.BankAccount
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateBankAccount updates a bank account record.
func (s *FinanceService) UpdateBankAccount(ctx context.Context, a *financemodels.BankAccount) error {
	return s.DB.WithContext(ctx).Save(a).Error
}

// DeleteBankAccountByID soft-deletes a bank account.
func (s *FinanceService) DeleteBankAccountByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).Delete(&financemodels.BankAccount{})
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}

// SetPrimaryBankAccount marks the specified account as primary for the business (clears others).
func (s *FinanceService) SetPrimaryBankAccount(ctx context.Context, businessID, id string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&financemodels.BankAccount{}).
			Where("business_id = ? AND deleted_at IS NULL", strings.TrimSpace(businessID)).
			Update("is_primary", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&financemodels.BankAccount{}).
			Where("id = ?", strings.TrimSpace(id)).
			Update("is_primary", true).Error; err != nil {
			return err
		}
		return nil
	})
}
