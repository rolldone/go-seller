package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go_framework/internal/keydb"
	marketingservices "go_framework/plugins/marketing/services"

	"github.com/gin-gonic/gin"
	redis "github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type SubscriptionHandler struct {
	svc *marketingservices.Service
}

func NewSubscriptionHandler(svc *marketingservices.Service) *SubscriptionHandler {
	return &SubscriptionHandler{svc: svc}
}

type publicSubscribeRequest struct {
	BusinessID     string                 `json:"businessId"`
	ProductID      *string                `json:"productId,omitempty"`
	CustomerID     *string                `json:"customerId,omitempty"`
	CustomerLocale *string                `json:"customerLocale,omitempty"`
	Email          string                 `json:"email"`
	Consent        *bool                  `json:"consent,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

type publicUnsubscribeRequest struct {
	ID         *string `json:"id,omitempty"`
	BusinessID *string `json:"businessId,omitempty"`
	ProductID  *string `json:"productId,omitempty"`
	Email      *string `json:"email,omitempty"`
}

type publicResendRequest struct {
	ID         *string `json:"id,omitempty"`
	BusinessID *string `json:"businessId,omitempty"`
	ProductID  *string `json:"productId,omitempty"`
	Email      *string `json:"email,omitempty"`
}

type exportSubscriptionsRequest struct {
	IDs        []string `json:"ids,omitempty"`
	BusinessID string   `json:"businessId,omitempty"`
	ProductID  string   `json:"productId,omitempty"`
	Email      string   `json:"email,omitempty"`
	Status     string   `json:"status,omitempty"`
	SelectAll  bool     `json:"selectAll,omitempty"`
	SelectPage bool     `json:"selectPage,omitempty"`
	Page       int      `json:"page,omitempty"`
	Limit      int      `json:"limit,omitempty"`
}

func parsePositiveIntQuery(value string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func resolveSubscriptionStatusQuery(activeValue, statusValue string) string {
	status := strings.ToLower(strings.TrimSpace(statusValue))
	if status != "" {
		return status
	}
	switch strings.ToLower(strings.TrimSpace(activeValue)) {
	case "true", "1", "yes":
		return "active"
	case "false", "0", "no":
		return "inactive"
	default:
		return ""
	}
}

func (h *SubscriptionHandler) PublicSubscribe(c *gin.Context) {
	var req publicSubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.BusinessID) == "" || strings.TrimSpace(req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "businessId and email are required"})
		return
	}
	consent := true
	if req.Consent != nil {
		consent = *req.Consent
	}
	prodID := ""
	if req.ProductID != nil {
		prodID = *req.ProductID
	}
	custID := ""
	if req.CustomerID != nil {
		custID = *req.CustomerID
	}
	locale := ""
	if req.CustomerLocale != nil {
		locale = strings.TrimSpace(*req.CustomerLocale)
	}
	row, err := h.svc.CreateSubscription(c.Request.Context(), req.BusinessID, prodID, custID, strings.TrimSpace(req.Email), consent, locale, req.Metadata)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": row})
}

func (h *SubscriptionHandler) PublicUnsubscribe(c *gin.Context) {
	var req publicUnsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ID != nil && strings.TrimSpace(*req.ID) != "" {
		rows, err := h.svc.UnsubscribeByID(c.Request.Context(), *req.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"unsubscribed": rows})
		return
	}
	if req.BusinessID == nil || req.Email == nil || strings.TrimSpace(*req.BusinessID) == "" || strings.TrimSpace(*req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide id or (businessId and email)"})
		return
	}
	prodID := ""
	if req.ProductID != nil {
		prodID = *req.ProductID
	}
	rows, err := h.svc.UnsubscribeByEmail(c.Request.Context(), *req.BusinessID, prodID, strings.TrimSpace(*req.Email))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"unsubscribed": rows})
}

func (h *SubscriptionHandler) List(c *gin.Context) {
	businessID := strings.TrimSpace(c.Query("business_id"))
	productID := strings.TrimSpace(c.Query("product_id"))
	email := strings.TrimSpace(c.Query("email"))
	status := resolveSubscriptionStatusQuery(c.Query("active"), c.Query("status"))
	page := parsePositiveIntQuery(c.Query("page"), 1)
	limit := parsePositiveIntQuery(c.Query("limit"), 20)
	rows, total, err := h.svc.ListSubscriptions(c.Request.Context(), businessID, productID, email, status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows, "total": total, "page": page, "limit": limit})
}

func (h *SubscriptionHandler) Export(c *gin.Context) {
	var req exportSubscriptionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := resolveSubscriptionStatusQuery("", req.Status)
	ids := make([]string, 0, len(req.IDs))
	for _, id := range req.IDs {
		if trimmed := strings.TrimSpace(id); trimmed != "" {
			ids = append(ids, trimmed)
		}
	}
	if req.SelectAll {
		ids = nil
	}

	filename := fmt.Sprintf("subscribers-%s.csv", time.Now().UTC().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Header("Cache-Control", "no-store")
	if _, err := c.Writer.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return
	}

	count, err := h.svc.ExportSubscriptionsCSV(c.Request.Context(), c.Writer, strings.TrimSpace(req.BusinessID), strings.TrimSpace(req.ProductID), strings.TrimSpace(req.Email), status, ids)
	if err != nil {
		if !c.Writer.Written() {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	fmt.Printf("marketing subscriptions export requested by admin=%s count=%d business_id=%s status=%s\n", adminID, count, strings.TrimSpace(req.BusinessID), status)
}

func (h *SubscriptionHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetSubscriptionByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *SubscriptionHandler) Delete(c *gin.Context) {
	rows, err := h.svc.DeleteSubscriptionByID(c.Request.Context(), strings.TrimSpace(c.Param("id")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": rows})
}

// PublicResend allows re-sending the confirmation email by subscription id or (businessId + email).
func (h *SubscriptionHandler) PublicResend(c *gin.Context) {
	var req publicResendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := c.Request.Context()
	if req.ID != nil && strings.TrimSpace(*req.ID) != "" {
		if err := h.svc.SendSubscriptionConfirmation(ctx, strings.TrimSpace(*req.ID)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"resent": true})
		return
	}
	if req.BusinessID == nil || req.Email == nil || strings.TrimSpace(*req.BusinessID) == "" || strings.TrimSpace(*req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide id or (businessId and email)"})
		return
	}
	prodID := ""
	if req.ProductID != nil {
		prodID = *req.ProductID
	}
	rows, _, err := h.svc.ListSubscriptions(ctx, *req.BusinessID, prodID, strings.TrimSpace(*req.Email), "", 1, 1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(rows) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}
	if err := h.svc.SendSubscriptionConfirmation(ctx, rows[0].ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"resent": true})
}

// AdminResend triggers a confirmation email resend for a given subscription id (admin).
func (h *SubscriptionHandler) AdminResend(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if err := h.svc.SendSubscriptionConfirmation(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"resent": true})
}

// Confirm validates a confirmation token, marks subscription as confirmed and returns a simple HTML page.
func (h *SubscriptionHandler) Confirm(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		c.String(http.StatusBadRequest, "token required")
		return
	}
	key := fmt.Sprintf("marketing:subscription:confirm:%s", token)
	if keydb.Client == nil {
		c.String(http.StatusInternalServerError, "confirmation service not available")
		return
	}
	raw, err := keydb.Client.Get(c.Request.Context(), key).Result()
	if err != nil {
		if err == redis.Nil {
			c.String(http.StatusNotFound, "invalid or expired token")
			return
		}
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	var payload map[string]string
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		c.String(http.StatusInternalServerError, "invalid token payload")
		return
	}
	subID := strings.TrimSpace(payload["subscription_id"])
	if subID == "" {
		c.String(http.StatusBadRequest, "invalid token payload")
		return
	}
	// mark subscription confirmed
	now := time.Now().UTC()
	res := h.svc.DB.WithContext(c.Request.Context()).Model(nil).Table("product_subscriptions").Where("id = ?", subID).Updates(map[string]interface{}{"is_confirmed": true, "confirmed_at": now})
	if res.Error != nil {
		c.String(http.StatusInternalServerError, res.Error.Error())
		return
	}
	// delete token
	_ = keydb.Client.Del(c.Request.Context(), key)

	// return a small HTML success page
	html := `<!doctype html><html><head><meta charset="utf-8"><title>Subscription Confirmed</title></head><body><h1>Subscription confirmed</h1><p>Thank you — your subscription has been confirmed.</p></body></html>`
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}
