package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAuthHandler_Login_BadJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewAuthHandler(nil)
	r.POST("/admin/auth/login", h.Login)

	req := httptest.NewRequest(http.MethodPost, "/admin/auth/login", strings.NewReader("{invalid"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected %d got %d", http.StatusBadRequest, w.Code)
	}
}

func TestAuthHandler_ResetPassword_TooShort(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewAuthHandler(nil)
	r.POST("/admin/auth/reset-password", h.ResetPassword)

	body := `{"token":"abc","password":"123"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/auth/reset-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected %d got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRequireAdminJWT_MissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/protected", RequireAdminJWT(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected %d got %d", http.StatusUnauthorized, w.Code)
	}

	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] == nil {
		t.Fatalf("expected error response")
	}
}

func TestIPRateLimiter_Exceeded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/limited", NewIPRateLimiter(1, 60_000_000_000), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req1 := httptest.NewRequest(http.MethodGet, "/limited", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("expected first request 200, got %d", w1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/limited", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("expected second request 429, got %d", w2.Code)
	}
	if w2.Header().Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header")
	}
}
