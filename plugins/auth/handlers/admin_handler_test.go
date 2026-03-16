package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdminHandler_Create_InvalidPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewAdminHandler(nil)
	r.POST("/admin/admins", h.Create)

	body := `{"username":"","email":"","password":"123"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/admins", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected %d got %d", http.StatusBadRequest, w.Code)
	}
}

func TestAdminHandler_ChangePassword_TooShort(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewAdminHandler(nil)
	r.PATCH("/admin/admins/:id/change-password", h.ChangePassword)

	body := `{"password":"123"}`
	req := httptest.NewRequest(http.MethodPatch, "/admin/admins/a1/change-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected %d got %d", http.StatusBadRequest, w.Code)
	}
}
