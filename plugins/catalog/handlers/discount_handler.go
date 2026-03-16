package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DiscountHandler manages HTTP payloads for product discounts.
type DiscountHandler struct {
	svc *catalogservices.CatalogService
}

// NewDiscountHandler builds a handler ready for dependency injection.
func NewDiscountHandler(svc *catalogservices.CatalogService) *DiscountHandler {
	return &DiscountHandler{svc: svc}
}

type createDiscountRequest struct {
	Name              string   `json:"name"`
	Description       *string  `json:"description"`
	DiscountType      string   `json:"discount_type"`
	DiscountValue     float64  `json:"discount_value"`
	MaxDiscountAmount *float64 `json:"max_discount_amount"`
	Priority          int      `json:"priority"`
	ProductIDs        []string `json:"product_ids"`
	ProductMinQty     *int     `json:"product_min_qty"`
	ProductQtyLimit   *int     `json:"product_qty_limit"`
	StartAt           string   `json:"start_at"`
	EndAt             *string  `json:"end_at"`
	MinOrderAmount    *float64 `json:"min_order_amount"`
	PerUserOnly       bool     `json:"per_user_only"`
	CustomerID        *string  `json:"customer_id"`
	UsageLimit        *int     `json:"usage_limit"`
	UsageLimitPerUser *int     `json:"usage_limit_per_user"`
	IsActive          bool     `json:"is_active"`
}

type updateDiscountRequest struct {
	Name              *string   `json:"name"`
	Description       *string   `json:"description"`
	DiscountType      *string   `json:"discount_type"`
	DiscountValue     *float64  `json:"discount_value"`
	MaxDiscountAmount *float64  `json:"max_discount_amount"`
	Priority          *int      `json:"priority"`
	ProductIDs        *[]string `json:"product_ids"`
	StartAt           *string   `json:"start_at"`
	EndAt             *string   `json:"end_at"`
	ProductMinQty     *int      `json:"product_min_qty"`
	ProductQtyLimit   *int      `json:"product_qty_limit"`
	MinOrderAmount    *float64  `json:"min_order_amount"`
	PerUserOnly       *bool     `json:"per_user_only"`
	CustomerID        *string   `json:"customer_id"`
	UsageLimit        *int      `json:"usage_limit"`
	UsageLimitPerUser *int      `json:"usage_limit_per_user"`
	IsActive          *bool     `json:"is_active"`
}

func (h *DiscountHandler) Create(c *gin.Context) {
	var req createDiscountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if req.DiscountValue < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "discount_value must be non-negative"})
		return
	}
	if req.Priority < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority must be non-negative"})
		return
	}
	startAt, err := parseDiscountTime(req.StartAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_at must be RFC3339"})
		return
	}
	endAt, err := parseOptionalDiscountTime(req.EndAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end_at must be RFC3339"})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	productIDs := catalogservices.NormalizeDiscountProductIDs(req.ProductIDs)
	discount := &catalogmodels.Discount{
		ID:                id,
		Name:              strings.TrimSpace(req.Name),
		Description:       trimStringPtr(req.Description),
		DiscountType:      defaultDiscountType(req.DiscountType),
		DiscountValue:     req.DiscountValue,
		MaxDiscountAmount: req.MaxDiscountAmount,
		Priority:          req.Priority,
		ProductIDs:        productIDs,
		ProductMinQty:     req.ProductMinQty,
		ProductQtyLimit:   req.ProductQtyLimit,
		StartAt:           startAt,
		EndAt:             endAt,
		MinOrderAmount:    req.MinOrderAmount,
		PerUserOnly:       req.PerUserOnly,
		CustomerID:        trimStringPtr(req.CustomerID),
		UsageLimit:        req.UsageLimit,
		UsageLimitPerUser: req.UsageLimitPerUser,
		IsActive:          req.IsActive,
	}
	if err := h.svc.CreateDiscount(c.Request.Context(), discount); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, discount)
}

func (h *DiscountHandler) List(c *gin.Context) {
	isActive, err := parseDiscountBoolQuery(c.Query("is_active"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid is_active"})
		return
	}
	page := parseDiscountIntParam(c.Query("page"), 1)
	limit := parseDiscountIntParam(c.Query("limit"), 20)
	items, total, err := h.svc.ListDiscounts(c.Request.Context(), catalogservices.DiscountListFilter{
		Query:      c.Query("q"),
		ProductID:  c.Query("product_id"),
		CustomerID: c.Query("customer_id"),
		IsActive:   isActive,
		Page:       page,
		Limit:      limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total, "page": page, "limit": limit})
}

func (h *DiscountHandler) GetByID(c *gin.Context) {
	discount, err := h.svc.GetDiscountByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "discount not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, discount)
}

func (h *DiscountHandler) Update(c *gin.Context) {
	var req updateDiscountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := map[string]interface{}{}
	if req.Name != nil {
		if strings.TrimSpace(*req.Name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
			return
		}
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		updates["description"] = trimStringPtr(req.Description)
	}
	if req.DiscountType != nil {
		updates["discount_type"] = defaultDiscountType(*req.DiscountType)
	}
	if req.DiscountValue != nil {
		if *req.DiscountValue < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "discount_value must be non-negative"})
			return
		}
		updates["discount_value"] = *req.DiscountValue
	}
	if req.MaxDiscountAmount != nil {
		updates["max_discount_amount"] = req.MaxDiscountAmount
	}
	if req.Priority != nil {
		if *req.Priority < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "priority must be non-negative"})
			return
		}
		updates["priority"] = *req.Priority
	}
	if req.StartAt != nil {
		start, err := parseDiscountTime(*req.StartAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_at must be RFC3339"})
			return
		}
		updates["start_at"] = start
	}
	if req.EndAt != nil {
		end, err := parseOptionalDiscountTime(req.EndAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "end_at must be RFC3339"})
			return
		}
		updates["end_at"] = end
	}
	if req.ProductMinQty != nil {
		updates["product_min_qty"] = req.ProductMinQty
	}
	if req.ProductQtyLimit != nil {
		updates["product_qty_limit"] = req.ProductQtyLimit
	}
	if req.MinOrderAmount != nil {
		updates["min_order_amount"] = req.MinOrderAmount
	}
	if req.PerUserOnly != nil {
		updates["per_user_only"] = *req.PerUserOnly
	}
	if req.CustomerID != nil {
		updates["customer_id"] = trimStringPtr(req.CustomerID)
	}
	if req.UsageLimit != nil {
		updates["usage_limit"] = req.UsageLimit
	}
	if req.UsageLimitPerUser != nil {
		updates["usage_limit_per_user"] = req.UsageLimitPerUser
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if len(updates) > 0 {
		if _, err := h.svc.UpdateDiscountByID(c.Request.Context(), c.Param("id"), updates); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	if req.ProductIDs != nil {
		productIDs := catalogservices.NormalizeDiscountProductIDs(*req.ProductIDs)
		if err := h.svc.SetDiscountProductIDs(c.Request.Context(), c.Param("id"), productIDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	discount, err := h.svc.GetDiscountByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "discount not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, discount)
}

func (h *DiscountHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteDiscountByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "discount not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

func defaultDiscountType(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if trimmed == "" {
		return "percentage"
	}
	if trimmed != "percentage" && trimmed != "fixed" {
		return "percentage"
	}
	return trimmed
}

func parseDiscountTime(value string) (time.Time, error) {
	return time.Parse(time.RFC3339, strings.TrimSpace(value))
}

func parseOptionalDiscountTime(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*value))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func trimStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func parseDiscountBoolQuery(value string) (*bool, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(value)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func parseDiscountIntParam(value string, fallback int) int {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

// single-product helper removed; product IDs are handled via product_ids and discount_products relation
