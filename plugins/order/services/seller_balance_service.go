package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go_framework/internal/db"
	"go_framework/plugins/order/models"

	"gorm.io/gorm"
)

type SellerBalanceService struct {
	DB *gorm.DB
}

type AdminSellerBalanceSummary struct {
	TotalBalance               int64 `json:"total_balance"`
	SellerCount                int64 `json:"seller_count"`
	PositiveBalanceSellerCount int64 `json:"positive_balance_seller_count"`
}

func NewSellerBalanceService(db *gorm.DB) *SellerBalanceService {
	return &SellerBalanceService{DB: db}
}

func (s *SellerBalanceService) GetAdminSummary(ctx context.Context) (*AdminSellerBalanceSummary, error) {
	type summaryRow struct {
		TotalBalance               int64
		SellerCount                int64
		PositiveBalanceSellerCount int64
	}

	var row summaryRow
	err := s.DB.WithContext(ctx).
		Model(&models.SellerBalance{}).
		Select(
			"COALESCE(SUM(balance), 0) AS total_balance, COUNT(*) AS seller_count, COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS positive_balance_seller_count",
		).
		Scan(&row).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get admin seller balance summary: %w", err)
	}

	return &AdminSellerBalanceSummary{
		TotalBalance:               row.TotalBalance,
		SellerCount:                row.SellerCount,
		PositiveBalanceSellerCount: row.PositiveBalanceSellerCount,
	}, nil
}

// GetSellerBalance retrieves the current balance for a seller
func (s *SellerBalanceService) GetSellerBalance(ctx context.Context, sellerID string) (*models.SellerBalance, error) {
	var balance models.SellerBalance
	result := s.DB.WithContext(ctx).Where("seller_id = ?", sellerID).First(&balance)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// Initialize balance if not exists
			return s.InitializeSellerBalance(ctx, sellerID)
		}
		return nil, fmt.Errorf("failed to get seller balance: %w", result.Error)
	}
	return &balance, nil
}

// InitializeSellerBalance creates a new seller balance record
func (s *SellerBalanceService) InitializeSellerBalance(ctx context.Context, sellerID string) (*models.SellerBalance, error) {
	balance := &models.SellerBalance{
		SellerID:  sellerID,
		Balance:   0,
		UpdatedAt: time.Now(),
	}
	result := s.DB.WithContext(ctx).Create(balance)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to initialize seller balance: %w", result.Error)
	}
	return balance, nil
}

// CreditBalance adds credits to seller balance (order settlement, refund reversals, etc.)
func (s *SellerBalanceService) CreditBalance(ctx context.Context, sellerID string, amount int64, source string, referenceID *string, referenceType *string, description *string) (*models.SellerBalanceMutation, error) {
	if amount <= 0 {
		return nil, errors.New("credit amount must be positive")
	}

	var mutation *models.SellerBalanceMutation

	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		// Get current balance
		var balance models.SellerBalance
		result := tx.Where("seller_id = ?", sellerID).First(&balance)
		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				// Initialize if not exists
				balance = models.SellerBalance{
					SellerID:  sellerID,
					Balance:   0,
					UpdatedAt: time.Now(),
				}
				if result := tx.Create(&balance); result.Error != nil {
					return fmt.Errorf("failed to initialize balance: %w", result.Error)
				}
			} else {
				return fmt.Errorf("failed to get balance: %w", result.Error)
			}
		}

		// Calculate new balance
		newBalance := balance.Balance + amount

		// Update balance
		if result := tx.Model(&balance).Update("balance", newBalance).Update("updated_at", time.Now()); result.Error != nil {
			return fmt.Errorf("failed to update balance: %w", result.Error)
		}

		// Record mutation
		mutation = &models.SellerBalanceMutation{
			SellerID:      sellerID,
			MutationType:  models.MutationTypeCredit,
			Amount:        amount,
			Source:        source,
			ReferenceID:   referenceID,
			ReferenceType: referenceType,
			Description:   description,
			BalanceAfter:  newBalance,
			CreatedAt:     time.Now(),
		}

		if result := tx.Create(mutation); result.Error != nil {
			return fmt.Errorf("failed to record mutation: %w", result.Error)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return mutation, nil
}

// DebetBalance deducts from seller balance (withdrawal, fees, penalties, etc.)
func (s *SellerBalanceService) DebetBalance(ctx context.Context, sellerID string, amount int64, source string, referenceID *string, referenceType *string, description *string) (*models.SellerBalanceMutation, error) {
	if amount <= 0 {
		return nil, errors.New("debet amount must be positive")
	}

	var mutation *models.SellerBalanceMutation

	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		// Get current balance
		var balance models.SellerBalance
		result := tx.Where("seller_id = ?", sellerID).First(&balance)
		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				return fmt.Errorf("seller balance not found, please initialize first")
			}
			return fmt.Errorf("failed to get balance: %w", result.Error)
		}

		// Check if enough balance
		if balance.Balance < amount {
			return fmt.Errorf("insufficient balance: current=%d, requested=%d", balance.Balance, amount)
		}

		// Calculate new balance
		newBalance := balance.Balance - amount

		// Update balance
		if result := tx.Model(&balance).Update("balance", newBalance).Update("updated_at", time.Now()); result.Error != nil {
			return fmt.Errorf("failed to update balance: %w", result.Error)
		}

		// Record mutation
		mutation = &models.SellerBalanceMutation{
			SellerID:      sellerID,
			MutationType:  models.MutationTypeDebet,
			Amount:        amount,
			Source:        source,
			ReferenceID:   referenceID,
			ReferenceType: referenceType,
			Description:   description,
			BalanceAfter:  newBalance,
			CreatedAt:     time.Now(),
		}

		if result := tx.Create(mutation); result.Error != nil {
			return fmt.Errorf("failed to record mutation: %w", result.Error)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return mutation, nil
}

// GetMutations retrieves mutation history for a seller
func (s *SellerBalanceService) GetMutations(ctx context.Context, sellerID string, limit int, offset int) ([]models.SellerBalanceMutation, int64, error) {
	var mutations []models.SellerBalanceMutation
	var total int64

	result := s.DB.WithContext(ctx).Where("seller_id = ?", sellerID).Order("created_at DESC").Offset(offset).Limit(limit).Find(&mutations)
	if result.Error != nil {
		return nil, 0, fmt.Errorf("failed to get mutations: %w", result.Error)
	}

	// Get total count
	s.DB.WithContext(ctx).Model(&models.SellerBalanceMutation{}).Where("seller_id = ?", sellerID).Count(&total)

	return mutations, total, nil
}

// GetMutationsByReference retrieves mutations for a specific reference (e.g., order)
func (s *SellerBalanceService) GetMutationsByReference(ctx context.Context, referenceType string, referenceID string) ([]models.SellerBalanceMutation, error) {
	var mutations []models.SellerBalanceMutation
	result := s.DB.WithContext(ctx).Where("reference_type = ? AND reference_id = ?", referenceType, referenceID).Order("created_at DESC").Find(&mutations)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get mutations: %w", result.Error)
	}
	return mutations, nil
}
