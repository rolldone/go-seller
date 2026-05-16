package services

import (
	"context"
	"fmt"
	"strings"
	"testing"

	settingmodels "go_framework/plugins/setting/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSettingServiceTest(t *testing.T) *Service {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&settingmodels.Setting{}); err != nil {
		t.Fatalf("failed to migrate settings schema: %v", err)
	}

	return New(db)
}

func TestService_GetManyReturnsRequestedValuesAndDefaults(t *testing.T) {
	service := setupSettingServiceTest(t)
	ctx := context.Background()

	if _, err := service.Upsert(ctx, "global", "maintenance.index", []byte("true"), nil); err != nil {
		t.Fatalf("failed to seed maintenance.index: %v", err)
	}
	if _, err := service.Upsert(ctx, "global", "maintenance.product_detail", []byte("false"), nil); err != nil {
		t.Fatalf("failed to seed maintenance.product_detail: %v", err)
	}

	values, err := service.GetMany(ctx, "global", []string{"maintenance.index", "maintenance.product_detail", "maintenance.business_page"}, map[string][]byte{
		"maintenance.business_page": []byte("false"),
	})
	if err != nil {
		t.Fatalf("GetMany returned error: %v", err)
	}

	if got := string(values["maintenance.index"]); got != "true" {
		t.Fatalf("expected maintenance.index true, got %q", got)
	}
	if got := string(values["maintenance.product_detail"]); got != "false" {
		t.Fatalf("expected maintenance.product_detail false, got %q", got)
	}
	if got := string(values["maintenance.business_page"]); got != "false" {
		t.Fatalf("expected maintenance.business_page default false, got %q", got)
	}
}
