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
	TotalBalance                               int64 `json:"total_balance"`
	SellerCount                                int64 `json:"seller_count"`
	PositiveBalanceSellerCount                 int64 `json:"positive_balance_seller_count"`
	SettlementTotalCount                       int64 `json:"settlement_total_count"`
	SettlementPendingCount                     int64 `json:"settlement_pending_count"`
	SettlementPendingAmount                    int64 `json:"settlement_pending_amount"`
	SettlementHeldCount                        int64 `json:"settlement_held_count"`
	SettlementHeldAmount                       int64 `json:"settlement_held_amount"`
	SettlementPartiallyReleasedCount           int64 `json:"settlement_partially_released_count"`
	SettlementPartiallyReleasedRemainingAmount int64 `json:"settlement_partially_released_remaining_amount"`
	SettlementReleasedCount                    int64 `json:"settlement_released_count"`
	SettlementReleasedAmount                   int64 `json:"settlement_released_amount"`
	SettlementRefundedCount                    int64 `json:"settlement_refunded_count"`
	SettlementRefundedAmount                   int64 `json:"settlement_refunded_amount"`
	SettlementReversedCount                    int64 `json:"settlement_reversed_count"`
	SettlementReversedAmount                   int64 `json:"settlement_reversed_amount"`
	SettlementLockedAmount                     int64 `json:"settlement_locked_amount"`
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
	type settlementSummaryRow struct {
		TotalCount                       int64
		PendingCount                     int64
		PendingAmount                    int64
		HeldCount                        int64
		HeldAmount                       int64
		PartiallyReleasedCount           int64
		PartiallyReleasedRemainingAmount int64
		ReleasedCount                    int64
		ReleasedAmount                   int64
		RefundedCount                    int64
		RefundedAmount                   int64
		ReversedCount                    int64
		ReversedAmount                   int64
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

	var settlementRow settlementSummaryRow
	const settlementQuery = `
SELECT
	COALESCE(COUNT(*), 0) AS total_count,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS pending_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount ELSE 0 END), 0) AS pending_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS held_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount ELSE 0 END), 0) AS held_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS partially_released_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount - released_amount ELSE 0 END), 0) AS partially_released_remaining_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS released_count,
	COALESCE(SUM(CASE WHEN status = ? THEN released_amount ELSE 0 END), 0) AS released_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS refunded_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount ELSE 0 END), 0) AS refunded_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS reversed_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount ELSE 0 END), 0) AS reversed_amount
FROM seller_settlements`
	if err := s.DB.WithContext(ctx).Raw(
		settlementQuery,
		models.SettlementStatusPending,
		models.SettlementStatusPending,
		models.SettlementStatusHeld,
		models.SettlementStatusHeld,
		models.SettlementStatusPartiallyReleased,
		models.SettlementStatusPartiallyReleased,
		models.SettlementStatusReleased,
		models.SettlementStatusReleased,
		models.SettlementStatusRefunded,
		models.SettlementStatusRefunded,
		models.SettlementStatusReversed,
		models.SettlementStatusReversed,
	).Scan(&settlementRow).Error; err != nil {
		return nil, fmt.Errorf("failed to get admin settlement summary: %w", err)
	}

	return &AdminSellerBalanceSummary{
		TotalBalance:                               row.TotalBalance,
		SellerCount:                                row.SellerCount,
		PositiveBalanceSellerCount:                 row.PositiveBalanceSellerCount,
		SettlementTotalCount:                       settlementRow.TotalCount,
		SettlementPendingCount:                     settlementRow.PendingCount,
		SettlementPendingAmount:                    settlementRow.PendingAmount,
		SettlementHeldCount:                        settlementRow.HeldCount,
		SettlementHeldAmount:                       settlementRow.HeldAmount,
		SettlementPartiallyReleasedCount:           settlementRow.PartiallyReleasedCount,
		SettlementPartiallyReleasedRemainingAmount: settlementRow.PartiallyReleasedRemainingAmount,
		SettlementReleasedCount:                    settlementRow.ReleasedCount,
		SettlementReleasedAmount:                   settlementRow.ReleasedAmount,
		SettlementRefundedCount:                    settlementRow.RefundedCount,
		SettlementRefundedAmount:                   settlementRow.RefundedAmount,
		SettlementReversedCount:                    settlementRow.ReversedCount,
		SettlementReversedAmount:                   settlementRow.ReversedAmount,
		SettlementLockedAmount:                     settlementRow.PendingAmount + settlementRow.HeldAmount + settlementRow.PartiallyReleasedRemainingAmount,
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

func (s *SellerBalanceService) creditBalanceTx(tx *gorm.DB, sellerID string, amount int64, source string, referenceID *string, referenceType *string, description *string) (*models.SellerBalanceMutation, error) {
	if tx == nil {
		return nil, errors.New("transaction is required")
	}
	if amount <= 0 {
		return nil, errors.New("credit amount must be positive")
	}

	if referenceID != nil && referenceType != nil {
		var existingCount int64
		if err := tx.Model(&models.SellerBalanceMutation{}).
			Where("seller_id = ? AND mutation_type = ? AND source = ? AND reference_type = ? AND reference_id = ?", sellerID, models.MutationTypeCredit, source, *referenceType, *referenceID).
			Count(&existingCount).Error; err != nil {
			return nil, err
		}
		if existingCount > 0 {
			return nil, nil
		}
	}

	var balance models.SellerBalance
	result := tx.Where("seller_id = ?", sellerID).First(&balance)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			balance = models.SellerBalance{
				SellerID:  sellerID,
				Balance:   0,
				UpdatedAt: time.Now(),
			}
			if result := tx.Create(&balance); result.Error != nil {
				return nil, fmt.Errorf("failed to initialize balance: %w", result.Error)
			}
		} else {
			return nil, fmt.Errorf("failed to get balance: %w", result.Error)
		}
	}

	newBalance := balance.Balance + amount
	if result := tx.Model(&balance).Update("balance", newBalance).Update("updated_at", time.Now()); result.Error != nil {
		return nil, fmt.Errorf("failed to update balance: %w", result.Error)
	}

	mutation := &models.SellerBalanceMutation{
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
		return nil, fmt.Errorf("failed to record mutation: %w", result.Error)
	}

	return mutation, nil
}

// CreditBalance adds credits to seller balance (order settlement, refund reversals, etc.)
func (s *SellerBalanceService) CreditBalance(ctx context.Context, sellerID string, amount int64, source string, referenceID *string, referenceType *string, description *string) (*models.SellerBalanceMutation, error) {
	var mutation *models.SellerBalanceMutation

	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		created, err := s.creditBalanceTx(tx, sellerID, amount, source, referenceID, referenceType, description)
		if err != nil {
			return err
		}
		mutation = created
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
