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

func setupSettlementTestService(t *testing.T) *SellerBalanceService {
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

func createTestSettlement(t *testing.T, svc *SellerBalanceService, sellerID string, orderID string, grossAmount int64) *models.SellerSettlement {
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

func createTestSettlementAt(t *testing.T, svc *SellerBalanceService, sellerID string, orderID string, grossAmount int64, createdAt time.Time) *models.SellerSettlement {
	t.Helper()

	settlement, err := svc.CreatePendingSettlement(context.Background(), CreateSettlementInput{
		SellerID:    sellerID,
		OrderID:     orderID,
		GrossAmount: grossAmount,
		CreatedAt:   createdAt,
	})
	if err != nil {
		t.Fatalf("failed to create pending settlement: %v", err)
	}
	return settlement
}

func TestGetSettlementSummary(t *testing.T) {
	svc := setupSettlementTestService(t)
	base := time.Date(2026, 5, 11, 10, 0, 0, 0, time.UTC)

	createTestSettlementAt(t, svc, "seller-summary", "order-pending", 10000, base.Add(-5*time.Minute))

	held := createTestSettlementAt(t, svc, "seller-summary", "order-held", 20000, base.Add(-4*time.Minute))
	if _, _, err := svc.DecideSettlement(context.Background(), held.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionHold,
		AdminID:  "admin-summary",
	}); err != nil {
		t.Fatalf("expected hold to succeed, got %v", err)
	}

	partial := createTestSettlementAt(t, svc, "seller-summary", "order-partial", 30000, base.Add(-3*time.Minute))
	partialAmount := int64(10000)
	if _, _, err := svc.DecideSettlement(context.Background(), partial.ID, SettlementDecisionInput{
		Decision:      models.SettlementDecisionPartialRelease,
		ReleaseAmount: &partialAmount,
		AdminID:       "admin-summary",
	}); err != nil {
		t.Fatalf("expected partial release to succeed, got %v", err)
	}

	released := createTestSettlementAt(t, svc, "seller-summary", "order-released", 40000, base.Add(-2*time.Minute))
	if _, _, err := svc.DecideSettlement(context.Background(), released.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRelease,
		AdminID:  "admin-summary",
	}); err != nil {
		t.Fatalf("expected full release to succeed, got %v", err)
	}

	refunded := createTestSettlementAt(t, svc, "seller-summary", "order-refunded", 5000, base.Add(-1*time.Minute))
	if _, _, err := svc.DecideSettlement(context.Background(), refunded.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRefund,
		AdminID:  "admin-summary",
	}); err != nil {
		t.Fatalf("expected refund to succeed, got %v", err)
	}

	summary, err := svc.GetSettlementSummary(context.Background(), "seller-summary")
	if err != nil {
		t.Fatalf("expected summary, got %v", err)
	}

	if summary.AvailableBalance != 50000 {
		t.Fatalf("expected available balance 50000, got %d", summary.AvailableBalance)
	}
	if summary.TotalCount != 5 {
		t.Fatalf("expected total count 5, got %d", summary.TotalCount)
	}
	if summary.PendingCount != 1 || summary.PendingAmount != 10000 {
		t.Fatalf("unexpected pending summary: %#v", summary)
	}
	if summary.HeldCount != 1 || summary.HeldAmount != 20000 {
		t.Fatalf("unexpected held summary: %#v", summary)
	}
	if summary.PartiallyReleasedCount != 1 || summary.PartiallyReleasedRemainingAmount != 20000 {
		t.Fatalf("unexpected partial summary: %#v", summary)
	}
	if summary.ReleasedCount != 1 || summary.ReleasedAmount != 40000 {
		t.Fatalf("unexpected released summary: %#v", summary)
	}
	if summary.RefundedCount != 1 || summary.RefundedAmount != 5000 {
		t.Fatalf("unexpected refunded summary: %#v", summary)
	}
	if summary.LockedAmount != 50000 {
		t.Fatalf("expected locked amount 50000, got %d", summary.LockedAmount)
	}
}

func TestListSettlementsFiltersAndPaginates(t *testing.T) {
	svc := setupSettlementTestService(t)
	base := time.Date(2026, 5, 11, 10, 0, 0, 0, time.UTC)

	createTestSettlementAt(t, svc, "seller-list", "order-1", 1000, base.Add(-3*time.Minute))
	second := createTestSettlementAt(t, svc, "seller-list", "order-2", 2000, base.Add(-2*time.Minute))
	if _, _, err := svc.DecideSettlement(context.Background(), second.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionHold,
		AdminID:  "admin-list",
	}); err != nil {
		t.Fatalf("expected hold to succeed, got %v", err)
	}
	createTestSettlementAt(t, svc, "seller-list", "order-3", 3000, base.Add(-1*time.Minute))

	held, total, err := svc.ListSettlements(context.Background(), ListSettlementsInput{
		SellerID: "seller-list",
		Status:   models.SettlementStatusHeld,
		Limit:    20,
		Offset:   0,
	})
	if err != nil {
		t.Fatalf("expected list, got %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1 for held filter, got %d", total)
	}
	if len(held) != 1 || held[0].OrderID != "order-2" {
		t.Fatalf("unexpected held results: %#v", held)
	}

	pageOne, totalAll, err := svc.ListSettlements(context.Background(), ListSettlementsInput{
		SellerID: "seller-list",
		Limit:    2,
		Offset:   0,
	})
	if err != nil {
		t.Fatalf("expected list page one, got %v", err)
	}
	if totalAll != 3 {
		t.Fatalf("expected total 3, got %d", totalAll)
	}
	if len(pageOne) != 2 {
		t.Fatalf("expected 2 items on first page, got %d", len(pageOne))
	}
	if pageOne[0].OrderID != "order-3" || pageOne[1].OrderID != "order-2" {
		t.Fatalf("unexpected order for first page: %#v", pageOne)
	}

	pageTwo, _, err := svc.ListSettlements(context.Background(), ListSettlementsInput{
		SellerID: "seller-list",
		Limit:    2,
		Offset:   2,
	})
	if err != nil {
		t.Fatalf("expected list page two, got %v", err)
	}
	if len(pageTwo) != 1 || pageTwo[0].OrderID != "order-1" {
		t.Fatalf("unexpected second page: %#v", pageTwo)
	}
}

func TestListSettlementsSupportsCombinedStatusFilters(t *testing.T) {
	svc := setupSettlementTestService(t)
	base := time.Date(2026, 5, 11, 10, 0, 0, 0, time.UTC)

	createTestSettlementAt(t, svc, "seller-combined", "order-pending", 1000, base.Add(-4*time.Minute))

	held := createTestSettlementAt(t, svc, "seller-combined", "order-held", 2000, base.Add(-3*time.Minute))
	if _, _, err := svc.DecideSettlement(context.Background(), held.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionHold,
		AdminID:  "admin-combined",
	}); err != nil {
		t.Fatalf("expected hold to succeed, got %v", err)
	}

	partial := createTestSettlementAt(t, svc, "seller-combined", "order-partial", 3000, base.Add(-2*time.Minute))
	partialAmount := int64(1000)
	if _, _, err := svc.DecideSettlement(context.Background(), partial.ID, SettlementDecisionInput{
		Decision:      models.SettlementDecisionPartialRelease,
		ReleaseAmount: &partialAmount,
		AdminID:       "admin-combined",
	}); err != nil {
		t.Fatalf("expected partial release to succeed, got %v", err)
	}

	released := createTestSettlementAt(t, svc, "seller-combined", "order-released", 4000, base.Add(-1*time.Minute))
	if _, _, err := svc.DecideSettlement(context.Background(), released.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRelease,
		AdminID:  "admin-combined",
	}); err != nil {
		t.Fatalf("expected release to succeed, got %v", err)
	}

	lockedItems, lockedTotal, err := svc.ListSettlements(context.Background(), ListSettlementsInput{
		SellerID: "seller-combined",
		Status:   "locked",
		Limit:    20,
		Offset:   0,
	})
	if err != nil {
		t.Fatalf("expected locked filter to succeed, got %v", err)
	}
	if lockedTotal != 3 || len(lockedItems) != 3 {
		t.Fatalf("expected 3 locked settlements, got total=%d len=%d", lockedTotal, len(lockedItems))
	}
	for _, item := range lockedItems {
		if item.Status == models.SettlementStatusReleased {
			t.Fatalf("released settlement must not be returned by locked filter: %#v", item)
		}
	}

	combinedItems, combinedTotal, err := svc.ListSettlements(context.Background(), ListSettlementsInput{
		SellerID: "seller-combined",
		Status:   models.SettlementStatusHeld + "," + models.SettlementStatusPartiallyReleased,
		Limit:    20,
		Offset:   0,
	})
	if err != nil {
		t.Fatalf("expected combined status filter to succeed, got %v", err)
	}
	if combinedTotal != 2 || len(combinedItems) != 2 {
		t.Fatalf("expected 2 settlements for combined status filter, got total=%d len=%d", combinedTotal, len(combinedItems))
	}
}

func TestDecideSettlementReleaseFull(t *testing.T) {
	svc := setupSettlementTestService(t)
	settlement := createTestSettlement(t, svc, "seller-1", "order-1", 10000)

	updated, mutation, err := svc.DecideSettlement(context.Background(), settlement.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRelease,
		AdminID:  "admin-1",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if mutation == nil {
		t.Fatalf("expected mutation, got nil")
	}
	if mutation.Amount != 10000 {
		t.Fatalf("expected mutation amount 10000, got %d", mutation.Amount)
	}
	if updated.Status != models.SettlementStatusReleased {
		t.Fatalf("expected status %s, got %s", models.SettlementStatusReleased, updated.Status)
	}
	if updated.ReleasedAmount != 10000 {
		t.Fatalf("expected released amount 10000, got %d", updated.ReleasedAmount)
	}

	balance, err := svc.GetSellerBalance(context.Background(), "seller-1")
	if err != nil {
		t.Fatalf("failed to load seller balance: %v", err)
	}
	if balance.Balance != 10000 {
		t.Fatalf("expected balance 10000, got %d", balance.Balance)
	}
}

func TestDecideSettlementPartialThenFinalRelease(t *testing.T) {
	svc := setupSettlementTestService(t)
	settlement := createTestSettlement(t, svc, "seller-2", "order-2", 10000)

	partialAmount := int64(4000)
	updated, mutation, err := svc.DecideSettlement(context.Background(), settlement.ID, SettlementDecisionInput{
		Decision:      models.SettlementDecisionPartialRelease,
		ReleaseAmount: &partialAmount,
		AdminID:       "admin-2",
	})
	if err != nil {
		t.Fatalf("expected no error on partial release, got %v", err)
	}
	if mutation == nil || mutation.Amount != partialAmount {
		t.Fatalf("expected mutation amount %d, got %#v", partialAmount, mutation)
	}
	if updated.Status != models.SettlementStatusPartiallyReleased {
		t.Fatalf("expected status %s, got %s", models.SettlementStatusPartiallyReleased, updated.Status)
	}
	if updated.ReleasedAmount != partialAmount {
		t.Fatalf("expected released amount %d, got %d", partialAmount, updated.ReleasedAmount)
	}

	updatedFinal, finalMutation, err := svc.DecideSettlement(context.Background(), settlement.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRelease,
		AdminID:  "admin-2",
	})
	if err != nil {
		t.Fatalf("expected no error on final release, got %v", err)
	}
	if finalMutation == nil {
		t.Fatalf("expected final mutation, got nil")
	}
	if finalMutation.Amount != 6000 {
		t.Fatalf("expected final mutation amount 6000, got %d", finalMutation.Amount)
	}
	if updatedFinal.Status != models.SettlementStatusReleased {
		t.Fatalf("expected final status %s, got %s", models.SettlementStatusReleased, updatedFinal.Status)
	}
	if updatedFinal.ReleasedAmount != 10000 {
		t.Fatalf("expected final released amount 10000, got %d", updatedFinal.ReleasedAmount)
	}
}

func TestDecideSettlementRefundAfterReleaseRejected(t *testing.T) {
	svc := setupSettlementTestService(t)
	settlement := createTestSettlement(t, svc, "seller-3", "order-3", 5000)

	releaseAmount := int64(1000)
	if _, _, err := svc.DecideSettlement(context.Background(), settlement.ID, SettlementDecisionInput{
		Decision:      models.SettlementDecisionPartialRelease,
		ReleaseAmount: &releaseAmount,
		AdminID:       "admin-3",
	}); err != nil {
		t.Fatalf("expected no error on initial partial release, got %v", err)
	}

	_, _, err := svc.DecideSettlement(context.Background(), settlement.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRefund,
		AdminID:  "admin-3",
	})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "refund after release is not supported yet") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDecideSettlementFinalizedCannotBeChanged(t *testing.T) {
	svc := setupSettlementTestService(t)
	settlement := createTestSettlement(t, svc, "seller-4", "order-4", 7000)

	if _, _, err := svc.DecideSettlement(context.Background(), settlement.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionRelease,
		AdminID:  "admin-4",
	}); err != nil {
		t.Fatalf("expected no error on release, got %v", err)
	}

	_, _, err := svc.DecideSettlement(context.Background(), settlement.ID, SettlementDecisionInput{
		Decision: models.SettlementDecisionHold,
		AdminID:  "admin-4",
	})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "settlement already finalized") {
		t.Fatalf("unexpected error: %v", err)
	}
}
