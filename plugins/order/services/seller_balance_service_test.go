package services

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"go_framework/plugins/order/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAdminSellerBalanceTestService(t *testing.T) *SellerBalanceService {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&models.SellerBalance{},
		&models.SellerBalanceMutation{},
		&models.SellerSettlement{},
	); err != nil {
		t.Fatalf("failed to migrate schema: %v", err)
	}

	return NewSellerBalanceService(db)
}

func createAdminTestSettlement(t *testing.T, svc *SellerBalanceService, sellerID string, orderID string, grossAmount int64) *models.SellerSettlement {
	t.Helper()

	settlement, err := svc.CreatePendingSettlement(context.Background(), CreateSettlementInput{
		SellerID:    sellerID,
		OrderID:     orderID,
		GrossAmount: grossAmount,
	})
	if err != nil {
		t.Fatalf("failed to create pending settlement: %v", err)
	}
	return settlement
}

func TestGetAdminSummaryIncludesSettlementStatusTotals(t *testing.T) {
	svc := setupAdminSellerBalanceTestService(t)

	if err := svc.DB.Create(&models.SellerBalance{SellerID: "seller-zero", Balance: 0, UpdatedAt: time.Now()}).Error; err != nil {
		t.Fatalf("failed to create zero balance seller: %v", err)
	}

	pending := createAdminTestSettlement(t, svc, "seller-a", "order-pending", 10000)
	_ = pending

	held := createAdminTestSettlement(t, svc, "seller-a", "order-held", 20000)
	if _, _, err := svc.DecideSettlement(context.Background(), held.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionHold,
		AdminID:  "admin-a",
	}); err != nil {
		t.Fatalf("expected hold to succeed, got %v", err)
	}

	partial := createAdminTestSettlement(t, svc, "seller-a", "order-partial", 30000)
	partialAmount := int64(10000)
	if _, _, err := svc.DecideSettlement(context.Background(), partial.ID, SettlementDecisionInput{
		Decision:      models.SettlementDecisionPartialRelease,
		ReleaseAmount: &partialAmount,
		AdminID:       "admin-a",
	}); err != nil {
		t.Fatalf("expected partial release to succeed, got %v", err)
	}

	released := createAdminTestSettlement(t, svc, "seller-b", "order-released", 40000)
	if _, _, err := svc.DecideSettlement(context.Background(), released.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRelease,
		AdminID:  "admin-b",
	}); err != nil {
		t.Fatalf("expected release to succeed, got %v", err)
	}

	refunded := createAdminTestSettlement(t, svc, "seller-b", "order-refunded", 5000)
	if _, _, err := svc.DecideSettlement(context.Background(), refunded.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRefund,
		AdminID:  "admin-b",
	}); err != nil {
		t.Fatalf("expected refund to succeed, got %v", err)
	}

	reversed := createAdminTestSettlement(t, svc, "seller-zero", "order-reversed", 6000)
	if err := svc.DB.WithContext(context.Background()).Model(&models.SellerSettlement{}).Where("id = ?", reversed.ID).Updates(map[string]any{
		"status":          models.SettlementStatusReversed,
		"released_amount": int64(2500),
		"release_scope":   models.SettlementScopeReversal,
		"decided_at":      time.Now(),
		"updated_at":      time.Now(),
	}).Error; err != nil {
		t.Fatalf("failed to mark settlement reversed: %v", err)
	}

	summary, err := svc.GetAdminSummary(context.Background())
	if err != nil {
		t.Fatalf("expected admin summary, got %v", err)
	}

	if summary.TotalBalance != 50000 {
		t.Fatalf("expected total balance 50000, got %d", summary.TotalBalance)
	}
	if summary.SellerCount != 3 {
		t.Fatalf("expected seller count 3, got %d", summary.SellerCount)
	}
	if summary.PositiveBalanceSellerCount != 2 {
		t.Fatalf("expected positive balance seller count 2, got %d", summary.PositiveBalanceSellerCount)
	}
	if summary.SettlementTotalCount != 6 {
		t.Fatalf("expected settlement total count 6, got %d", summary.SettlementTotalCount)
	}
	if summary.SettlementPendingCount != 1 || summary.SettlementPendingAmount != 10000 {
		t.Fatalf("unexpected pending summary: %#v", summary)
	}
	if summary.SettlementHeldCount != 1 || summary.SettlementHeldAmount != 20000 {
		t.Fatalf("unexpected held summary: %#v", summary)
	}
	if summary.SettlementPartiallyReleasedCount != 1 || summary.SettlementPartiallyReleasedRemainingAmount != 20000 {
		t.Fatalf("unexpected partial summary: %#v", summary)
	}
	if summary.SettlementReleasedCount != 1 || summary.SettlementReleasedAmount != 40000 {
		t.Fatalf("unexpected released summary: %#v", summary)
	}
	if summary.SettlementRefundedCount != 1 || summary.SettlementRefundedAmount != 5000 {
		t.Fatalf("unexpected refunded summary: %#v", summary)
	}
	if summary.SettlementReversedCount != 1 || summary.SettlementReversedAmount != 6000 {
		t.Fatalf("unexpected reversed summary: %#v", summary)
	}
	if summary.SettlementLockedAmount != 50000 {
		t.Fatalf("expected locked amount 50000, got %d", summary.SettlementLockedAmount)
	}
}
