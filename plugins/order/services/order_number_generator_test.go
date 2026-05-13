package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"go_framework/plugins/order/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupOrderNumberGeneratorTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&models.Order{}); err != nil {
		t.Fatalf("failed to migrate order schema: %v", err)
	}

	return db
}

func TestNextOrderNumberTxUsesDailySequencePerPrefix(t *testing.T) {
	db := setupOrderNumberGeneratorTestDB(t)
	svc := NewOrderService(db)
	now := time.Date(2026, 5, 14, 9, 30, 0, 0, time.UTC)

	var first string
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		first, err = svc.nextOrderNumberTx(tx, "ORD", now)
		return err
	}); err != nil {
		t.Fatalf("first nextOrderNumberTx failed: %v", err)
	}
	if first != "ORD-20260514-00000001" {
		t.Fatalf("unexpected first order number: %s", first)
	}

	if err := db.Create(&models.Order{ID: "order-1", OrderNumber: first, CreatedAt: now}).Error; err != nil {
		t.Fatalf("failed to seed first order: %v", err)
	}

	var second string
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		second, err = svc.nextOrderNumberTx(tx, "ord", now)
		return err
	}); err != nil {
		t.Fatalf("second nextOrderNumberTx failed: %v", err)
	}
	if second != "ORD-20260514-00000002" {
		t.Fatalf("unexpected second order number: %s", second)
	}

	var pos string
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		pos, err = svc.nextOrderNumberTx(tx, "POS", now)
		return err
	}); err != nil {
		t.Fatalf("pos nextOrderNumberTx failed: %v", err)
	}
	if pos != "POS-20260514-00000001" {
		t.Fatalf("unexpected POS order number: %s", pos)
	}
}
