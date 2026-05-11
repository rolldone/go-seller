package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	authmodels "go_framework/plugins/auth/models"
	financemodels "go_framework/plugins/finance/models"
	ordermodels "go_framework/plugins/order/models"
	settingmodels "go_framework/plugins/setting/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupOrderRefundWalletTestService(t *testing.T) *OrderService {
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
		&ordermodels.Order{},
		&ordermodels.OrderItem{},
		&ordermodels.Payment{},
		&ordermodels.OrderCoupon{},
		&ordermodels.OrderExtraCharge{},
		&ordermodels.OrderShipment{},
		&ordermodels.OrderShipmentItem{},
		&settingmodels.Setting{},
	); err != nil {
		t.Fatalf("failed to migrate schema: %v", err)
	}

	return &OrderService{DB: db}
}

func TestMarkDisputeRefundCompletedCreditsCustomerWallet(t *testing.T) {
	svc := setupOrderRefundWalletTestService(t)

	customer := &authmodels.Customer{
		ID:    "11111111-1111-1111-1111-111111111111",
		Name:  "Jane Customer",
		Email: "jane.customer@example.com",
	}
	if err := svc.DB.Create(customer).Error; err != nil {
		t.Fatalf("failed to create customer: %v", err)
	}

	metadata := map[string]any{
		orderDisputeMetadataKey: (&orderDisputeMetadata{
			AdminDecision: orderDisputeDecisionCustomerWon,
		}).toMap(),
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		t.Fatalf("failed to marshal metadata: %v", err)
	}

	order := &ordermodels.Order{
		ID:            "22222222-2222-2222-2222-222222222222",
		OrderNumber:   "ORD-REFUND-001",
		CustomerID:    &customer.ID,
		Status:        OrderStatusInDispute,
		PaymentStatus: "paid",
		GrandTotal:    123.45,
		Metadata:      metadataJSON,
	}
	if err := svc.DB.Create(order).Error; err != nil {
		t.Fatalf("failed to create order: %v", err)
	}

	updated, err := svc.MarkDisputeRefundCompleted(context.Background(), order.ID, "admin-1", "refund manual disetujui")
	if err != nil {
		t.Fatalf("expected refund completion to succeed, got %v", err)
	}
	if updated == nil || updated.Status != OrderStatusRefunded {
		t.Fatalf("expected refunded order, got %#v", updated)
	}

	var wallet financemodels.CustomerWallet
	if err := svc.DB.Where("customer_id = ?", customer.ID).First(&wallet).Error; err != nil {
		t.Fatalf("failed to load customer wallet: %v", err)
	}
	if wallet.CashBalance != 12345 {
		t.Fatalf("expected cash balance 12345, got %d", wallet.CashBalance)
	}
	if wallet.PromoBalance != 0 {
		t.Fatalf("expected promo balance 0, got %d", wallet.PromoBalance)
	}

	var mutation financemodels.CustomerWalletMutation
	if err := svc.DB.Where("customer_id = ?", customer.ID).Order("created_at desc, id desc").First(&mutation).Error; err != nil {
		t.Fatalf("failed to load wallet mutation: %v", err)
	}
	if mutation.BalanceType != financemodels.CustomerWalletBalanceTypeCash {
		t.Fatalf("expected cash mutation, got %s", mutation.BalanceType)
	}
	if mutation.Source != financemodels.CustomerWalletSourceRefund {
		t.Fatalf("expected refund source, got %s", mutation.Source)
	}
	if mutation.Amount != 12345 {
		t.Fatalf("expected mutation amount 12345, got %d", mutation.Amount)
	}
	if mutation.BalanceAfter != 12345 {
		t.Fatalf("expected balance after 12345, got %d", mutation.BalanceAfter)
	}
}
