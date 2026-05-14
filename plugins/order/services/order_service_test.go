package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	settingmodels "go_framework/plugins/setting/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestGetOrderByIDRejectsEmptyID(t *testing.T) {
	service := &OrderService{}

	testCases := []struct {
		name string
		id   string
	}{
		{name: "empty", id: ""},
		{name: "whitespace", id: "   \t\n  "},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			order, err := service.GetOrderByID(context.Background(), testCase.id)
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				t.Fatalf("expected gorm.ErrRecordNotFound, got %v", err)
			}
			if order != nil {
				t.Fatalf("expected nil order, got %#v", order)
			}
		})
	}
}

func setupOrderServiceTest(t *testing.T) *OrderService {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&settingmodels.Setting{}); err != nil {
		t.Fatalf("failed to migrate settings schema: %v", err)
	}

	return NewOrderService(db)
}

func TestGetOrderExpiryHoursUsesDefaultWhenSettingMissing(t *testing.T) {
	service := setupOrderServiceTest(t)

	hours, err := service.getOrderExpiryHours(context.Background())
	if err != nil {
		t.Fatalf("expected missing setting to be non-fatal, got %v", err)
	}
	if hours != defaultOrderExpiryHours {
		t.Fatalf("expected default expiry hours %d, got %d", defaultOrderExpiryHours, hours)
	}
}
