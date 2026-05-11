package services

import (
	"context"
	"fmt"
	"strings"
	"testing"

	authmodels "go_framework/plugins/auth/models"
	financemodels "go_framework/plugins/finance/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCustomerWalletTestService(t *testing.T) *FinanceService {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&authmodels.Customer{},
		&financemodels.CustomerWallet{},
		&financemodels.CustomerWalletMutation{},
		&financemodels.CustomerWalletWithdrawal{},
	); err != nil {
		t.Fatalf("failed to migrate schema: %v", err)
	}

	return New(db, nil)
}

func TestRequestCustomerWithdrawalDebitsWalletAndCreatesPendingRequest(t *testing.T) {
	svc := setupCustomerWalletTestService(t)

	customer := &authmodels.Customer{ID: "11111111-1111-1111-1111-111111111111", Name: "Test Customer", Email: "customer@example.com"}
	if err := svc.DB.Create(customer).Error; err != nil {
		t.Fatalf("failed to create customer: %v", err)
	}

	creditTx := svc.DB.Begin()
	if _, err := svc.CreditCustomerWalletTx(creditTx, customer.ID, 50000, financemodels.CustomerWalletBalanceTypeCash, financemodels.CustomerWalletSourceRefund, nil, nil, nil); err != nil {
		_ = creditTx.Rollback().Error
		t.Fatalf("failed to credit wallet: %v", err)
	}
	if err := creditTx.Commit().Error; err != nil {
		t.Fatalf("failed to commit wallet credit: %v", err)
	}

	withdrawal, err := svc.RequestCustomerWithdrawal(context.Background(), customer.ID, CustomerWalletWithdrawalInput{
		Amount:            20000,
		BankName:          "BCA",
		BankAccountNumber: "1234567890",
		BankAccountName:   "Test Customer",
		Notes:             nil,
	})
	if err != nil {
		t.Fatalf("expected withdrawal request to succeed, got %v", err)
	}
	if withdrawal == nil {
		t.Fatalf("expected withdrawal record")
	}
	if withdrawal.Status != financemodels.CustomerWalletWithdrawalStatusSubmitted {
		t.Fatalf("expected submitted status, got %s", withdrawal.Status)
	}
	if withdrawal.RequestedAmount != 20000 {
		t.Fatalf("expected requested amount 20000, got %d", withdrawal.RequestedAmount)
	}
	if withdrawal.NetAmount != 20000 {
		t.Fatalf("expected net amount 20000, got %d", withdrawal.NetAmount)
	}

	var wallet financemodels.CustomerWallet
	if err := svc.DB.Where("customer_id = ?", customer.ID).First(&wallet).Error; err != nil {
		t.Fatalf("failed to load wallet: %v", err)
	}
	if wallet.CashBalance != 30000 {
		t.Fatalf("expected cash balance 30000, got %d", wallet.CashBalance)
	}

	var mutation financemodels.CustomerWalletMutation
	if err := svc.DB.Where("customer_id = ?", customer.ID).Order("created_at desc, id desc").First(&mutation).Error; err != nil {
		t.Fatalf("failed to load wallet mutation: %v", err)
	}
	if mutation.MutationType != financemodels.CustomerWalletMutationTypeDebet {
		t.Fatalf("expected debet mutation, got %s", mutation.MutationType)
	}
	if mutation.Source != financemodels.CustomerWalletSourceWithdraw {
		t.Fatalf("expected withdraw source, got %s", mutation.Source)
	}
	if mutation.Amount != 20000 {
		t.Fatalf("expected mutation amount 20000, got %d", mutation.Amount)
	}
	if mutation.BalanceAfter != 30000 {
		t.Fatalf("expected balance after 30000, got %d", mutation.BalanceAfter)
	}

	summary, err := svc.GetCustomerWalletSummary(context.Background(), customer.ID)
	if err != nil {
		t.Fatalf("expected summary, got %v", err)
	}
	if summary.CashBalance != 30000 || summary.AvailableBalance != 30000 {
		t.Fatalf("unexpected summary balance: %#v", summary)
	}
	if summary.WithdrawalPendingCount != 1 || summary.WithdrawalPendingAmount != 20000 {
		t.Fatalf("unexpected pending withdrawal summary: %#v", summary)
	}

	items, total, err := svc.ListCustomerWalletWithdrawals(context.Background(), customer.ID, CustomerWalletWithdrawalListInput{Limit: 20, Offset: 0})
	if err != nil {
		t.Fatalf("expected withdrawal list, got %v", err)
	}
	if total != 1 || len(items) != 1 {
		t.Fatalf("unexpected withdrawal list response: total=%d len=%d", total, len(items))
	}
	if items[0].ID != withdrawal.ID {
		t.Fatalf("expected same withdrawal id, got %d vs %d", items[0].ID, withdrawal.ID)
	}
}
