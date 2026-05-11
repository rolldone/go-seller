package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go_framework/internal/db"
	financemodels "go_framework/plugins/finance/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var customerWalletOpenWithdrawalStatuses = []string{
	financemodels.CustomerWalletWithdrawalStatusSubmitted,
	financemodels.CustomerWalletWithdrawalStatusUnderReview,
	financemodels.CustomerWalletWithdrawalStatusAwaitingConfirmation,
	financemodels.CustomerWalletWithdrawalStatusApproved,
}

type CustomerWalletSummary struct {
	CustomerID              string `json:"customer_id"`
	CashBalance             int64  `json:"cash_balance"`
	PromoBalance            int64  `json:"promo_balance"`
	AvailableBalance        int64  `json:"available_balance"`
	WithdrawalTotalCount    int64  `json:"withdrawal_total_count"`
	WithdrawalTotalAmount   int64  `json:"withdrawal_total_amount"`
	WithdrawalPendingCount  int64  `json:"withdrawal_pending_count"`
	WithdrawalPendingAmount int64  `json:"withdrawal_pending_amount"`
}

type CustomerWalletWithdrawalInput struct {
	Amount            int64   `json:"amount"`
	BankName          string  `json:"bank_name"`
	BankAccountNumber string  `json:"bank_account_number"`
	BankAccountName   string  `json:"bank_account_name"`
	Notes             *string `json:"notes"`
}

type CustomerWalletWithdrawalListInput struct {
	Status string
	Limit  int
	Offset int
}

func normalizeCustomerWalletBalanceType(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return financemodels.CustomerWalletBalanceTypeCash, nil
	}
	switch trimmed {
	case financemodels.CustomerWalletBalanceTypeCash, financemodels.CustomerWalletBalanceTypePromo:
		return trimmed, nil
	default:
		return "", fmt.Errorf("invalid wallet balance type: %s", raw)
	}
}

func trimOptionalText(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func (s *FinanceService) loadOrCreateCustomerWalletTx(tx *gorm.DB, customerID string, now time.Time) (*financemodels.CustomerWallet, error) {
	if tx == nil {
		return nil, errors.New("transaction is required")
	}
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedCustomerID == "" {
		return nil, errors.New("customer id is required")
	}

	seed := &financemodels.CustomerWallet{
		CustomerID:   trimmedCustomerID,
		CashBalance:  0,
		PromoBalance: 0,
		UpdatedAt:    now,
	}
	if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "customer_id"}}, DoNothing: true}).Create(seed).Error; err != nil {
		return nil, fmt.Errorf("failed to ensure customer wallet: %w", err)
	}

	var wallet financemodels.CustomerWallet
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("customer_id = ?", trimmedCustomerID).First(&wallet).Error; err != nil {
		return nil, fmt.Errorf("failed to load customer wallet: %w", err)
	}
	return &wallet, nil
}

func (s *FinanceService) CreditCustomerWalletTx(tx *gorm.DB, customerID string, amount int64, balanceType string, source string, referenceID *string, referenceType *string, description *string) (*financemodels.CustomerWalletMutation, error) {
	if amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	if strings.TrimSpace(source) == "" {
		return nil, errors.New("source is required")
	}
	normalizedBalanceType, err := normalizeCustomerWalletBalanceType(balanceType)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	wallet, err := s.loadOrCreateCustomerWalletTx(tx, customerID, now)
	if err != nil {
		return nil, err
	}

	updates := map[string]any{"updated_at": now}
	var balanceAfter int64
	switch normalizedBalanceType {
	case financemodels.CustomerWalletBalanceTypeCash:
		balanceAfter = wallet.CashBalance + amount
		updates["cash_balance"] = balanceAfter
	case financemodels.CustomerWalletBalanceTypePromo:
		balanceAfter = wallet.PromoBalance + amount
		updates["promo_balance"] = balanceAfter
	default:
		return nil, fmt.Errorf("unsupported wallet balance type: %s", normalizedBalanceType)
	}

	if err := tx.Model(&financemodels.CustomerWallet{}).Where("customer_id = ?", strings.TrimSpace(customerID)).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update customer wallet: %w", err)
	}

	mutation := &financemodels.CustomerWalletMutation{
		CustomerID:    strings.TrimSpace(customerID),
		BalanceType:   normalizedBalanceType,
		MutationType:  financemodels.CustomerWalletMutationTypeCredit,
		Amount:        amount,
		Source:        strings.TrimSpace(source),
		ReferenceID:   referenceID,
		ReferenceType: referenceType,
		Description:   description,
		BalanceAfter:  balanceAfter,
		CreatedAt:     now,
	}
	if err := tx.Create(mutation).Error; err != nil {
		return nil, fmt.Errorf("failed to create customer wallet mutation: %w", err)
	}

	return mutation, nil
}

func (s *FinanceService) DebitCustomerWalletTx(tx *gorm.DB, customerID string, amount int64, balanceType string, source string, referenceID *string, referenceType *string, description *string) (*financemodels.CustomerWalletMutation, error) {
	if amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	if strings.TrimSpace(source) == "" {
		return nil, errors.New("source is required")
	}
	normalizedBalanceType, err := normalizeCustomerWalletBalanceType(balanceType)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	wallet, err := s.loadOrCreateCustomerWalletTx(tx, customerID, now)
	if err != nil {
		return nil, err
	}

	updates := map[string]any{"updated_at": now}
	var balanceAfter int64
	switch normalizedBalanceType {
	case financemodels.CustomerWalletBalanceTypeCash:
		if wallet.CashBalance < amount {
			return nil, errors.New("insufficient cash balance")
		}
		balanceAfter = wallet.CashBalance - amount
		updates["cash_balance"] = balanceAfter
	case financemodels.CustomerWalletBalanceTypePromo:
		if wallet.PromoBalance < amount {
			return nil, errors.New("insufficient promo balance")
		}
		balanceAfter = wallet.PromoBalance - amount
		updates["promo_balance"] = balanceAfter
	default:
		return nil, fmt.Errorf("unsupported wallet balance type: %s", normalizedBalanceType)
	}

	if err := tx.Model(&financemodels.CustomerWallet{}).Where("customer_id = ?", strings.TrimSpace(customerID)).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update customer wallet: %w", err)
	}

	mutation := &financemodels.CustomerWalletMutation{
		CustomerID:    strings.TrimSpace(customerID),
		BalanceType:   normalizedBalanceType,
		MutationType:  financemodels.CustomerWalletMutationTypeDebet,
		Amount:        amount,
		Source:        strings.TrimSpace(source),
		ReferenceID:   referenceID,
		ReferenceType: referenceType,
		Description:   description,
		BalanceAfter:  balanceAfter,
		CreatedAt:     now,
	}
	if err := tx.Create(mutation).Error; err != nil {
		return nil, fmt.Errorf("failed to create customer wallet mutation: %w", err)
	}

	return mutation, nil
}

func (s *FinanceService) GetCustomerWalletSummary(ctx context.Context, customerID string) (*CustomerWalletSummary, error) {
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedCustomerID == "" {
		return nil, errors.New("customer id is required")
	}

	summary := &CustomerWalletSummary{CustomerID: trimmedCustomerID}

	var wallet financemodels.CustomerWallet
	if err := s.DB.WithContext(ctx).Where("customer_id = ?", trimmedCustomerID).First(&wallet).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("failed to load customer wallet: %w", err)
		}
	}
	summary.CashBalance = wallet.CashBalance
	summary.PromoBalance = wallet.PromoBalance
	summary.AvailableBalance = wallet.CashBalance

	var stats struct {
		TotalCount    int64
		TotalAmount   int64
		PendingCount  int64
		PendingAmount int64
	}
	const query = `
SELECT
	COALESCE(COUNT(*), 0) AS total_count,
	COALESCE(SUM(requested_amount), 0) AS total_amount,
	COALESCE(SUM(CASE WHEN status IN (?, ?, ?, ?) THEN 1 ELSE 0 END), 0) AS pending_count,
	COALESCE(SUM(CASE WHEN status IN (?, ?, ?, ?) THEN requested_amount ELSE 0 END), 0) AS pending_amount
FROM customer_wallet_withdrawals
WHERE customer_id = ?`
	if err := s.DB.WithContext(ctx).Raw(
		query,
		financemodels.CustomerWalletWithdrawalStatusSubmitted,
		financemodels.CustomerWalletWithdrawalStatusUnderReview,
		financemodels.CustomerWalletWithdrawalStatusAwaitingConfirmation,
		financemodels.CustomerWalletWithdrawalStatusApproved,
		financemodels.CustomerWalletWithdrawalStatusSubmitted,
		financemodels.CustomerWalletWithdrawalStatusUnderReview,
		financemodels.CustomerWalletWithdrawalStatusAwaitingConfirmation,
		financemodels.CustomerWalletWithdrawalStatusApproved,
		trimmedCustomerID,
	).Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("failed to load customer wallet withdrawal stats: %w", err)
	}

	summary.WithdrawalTotalCount = stats.TotalCount
	summary.WithdrawalTotalAmount = stats.TotalAmount
	summary.WithdrawalPendingCount = stats.PendingCount
	summary.WithdrawalPendingAmount = stats.PendingAmount

	return summary, nil
}

func (s *FinanceService) ListCustomerWalletWithdrawals(ctx context.Context, customerID string, input CustomerWalletWithdrawalListInput) ([]financemodels.CustomerWalletWithdrawal, int64, error) {
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedCustomerID == "" {
		return nil, 0, errors.New("customer id is required")
	}

	limit := input.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	query := s.DB.WithContext(ctx).Model(&financemodels.CustomerWalletWithdrawal{}).Where("customer_id = ?", trimmedCustomerID)
	if status := strings.TrimSpace(input.Status); status != "" {
		query = query.Where("status = ?", strings.ToLower(status))
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count customer withdrawals: %w", err)
	}

	var items []financemodels.CustomerWalletWithdrawal
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list customer withdrawals: %w", err)
	}

	return items, total, nil
}

func (s *FinanceService) GetCustomerWalletWithdrawalByID(ctx context.Context, customerID string, withdrawalID int64) (*financemodels.CustomerWalletWithdrawal, error) {
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedCustomerID == "" {
		return nil, errors.New("customer id is required")
	}
	if withdrawalID <= 0 {
		return nil, errors.New("withdrawal id is required")
	}

	var withdrawal financemodels.CustomerWalletWithdrawal
	if err := s.DB.WithContext(ctx).Where("id = ? AND customer_id = ?", withdrawalID, trimmedCustomerID).First(&withdrawal).Error; err != nil {
		return nil, err
	}
	return &withdrawal, nil
}

func (s *FinanceService) RequestCustomerWithdrawal(ctx context.Context, customerID string, input CustomerWalletWithdrawalInput) (*financemodels.CustomerWalletWithdrawal, error) {
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedCustomerID == "" {
		return nil, errors.New("customer id is required")
	}
	if input.Amount <= 0 {
		return nil, errors.New("withdrawal amount must be positive")
	}
	bankName := strings.TrimSpace(input.BankName)
	bankAccountNumber := strings.TrimSpace(input.BankAccountNumber)
	bankAccountName := strings.TrimSpace(input.BankAccountName)
	if bankName == "" || bankAccountNumber == "" || bankAccountName == "" {
		return nil, errors.New("bank details are required")
	}

	var withdrawal *financemodels.CustomerWalletWithdrawal
	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		now := time.Now()
		wallet, err := s.loadOrCreateCustomerWalletTx(tx, trimmedCustomerID, now)
		if err != nil {
			return err
		}
		if wallet.CashBalance < input.Amount {
			return errors.New("insufficient cash balance")
		}

		withdrawal = &financemodels.CustomerWalletWithdrawal{
			CustomerID:        trimmedCustomerID,
			RequestedAmount:   input.Amount,
			AdminFee:          0,
			OtherFee:          0,
			NetAmount:         input.Amount,
			Status:            financemodels.CustomerWalletWithdrawalStatusSubmitted,
			BankName:          bankName,
			BankAccountNumber: bankAccountNumber,
			BankAccountName:   bankAccountName,
			Notes:             trimOptionalText(input.Notes),
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		if err := tx.Create(withdrawal).Error; err != nil {
			return fmt.Errorf("failed to create customer withdrawal: %w", err)
		}

		referenceID := fmt.Sprintf("%d", withdrawal.ID)
		referenceType := financemodels.CustomerWalletReferenceTypeWithdrawal
		description := fmt.Sprintf("Customer withdrawal request #%d to %s %s", withdrawal.ID, bankName, bankAccountNumber)
		if _, err := s.DebitCustomerWalletTx(
			tx,
			trimmedCustomerID,
			input.Amount,
			financemodels.CustomerWalletBalanceTypeCash,
			financemodels.CustomerWalletSourceWithdraw,
			&referenceID,
			&referenceType,
			&description,
		); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return withdrawal, nil
}
