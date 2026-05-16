package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	settingmodels "go_framework/plugins/setting/models"
	pluginservices "go_framework/plugins/setting/services"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSettingHandlerTest(t *testing.T) *pluginservices.Service {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&settingmodels.Setting{}); err != nil {
		t.Fatalf("failed to migrate settings schema: %v", err)
	}

	service := pluginservices.New(db)
	if _, err := service.Upsert(t.Context(), "global", "maintenance.index", []byte("true"), nil); err != nil {
		t.Fatalf("failed to seed maintenance.index: %v", err)
	}
	if _, err := service.Upsert(t.Context(), "global", "maintenance.product_detail", []byte("false"), nil); err != nil {
		t.Fatalf("failed to seed maintenance.product_detail: %v", err)
	}

	return service
}

func TestSettingHandler_PublicMaintenance_RequestedKeysOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := setupSettingHandlerTest(t)
	handler := NewSettingHandler(service)
	router := gin.New()
	router.GET("/api/settings/maintenance", handler.PublicMaintenance)

	req := httptest.NewRequest(http.MethodGet, "/api/settings/maintenance?keys=index,product_detail", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp struct {
		Data map[string]bool `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if got := resp.Data["index"]; !got {
		t.Fatalf("expected index=true, got %v", got)
	}
	if got := resp.Data["product_detail"]; got {
		t.Fatalf("expected product_detail=false, got %v", got)
	}
	if _, ok := resp.Data["business_page"]; ok {
		t.Fatalf("did not expect business_page in response")
	}
	if _, ok := resp.Data["order_customer_confirmation"]; ok {
		t.Fatalf("did not expect order_customer_confirmation in response")
	}
}
