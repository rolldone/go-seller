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

// CouponHandler manages HTTP payloads for promotions.
type CouponHandler struct {
	svc *catalogservices.CatalogService
}

// NewCouponHandler builds a handler ready for dependency injection.
func NewCouponHandler(svc *catalogservices.CatalogService) *CouponHandler {
	return &CouponHandler{svc: svc}
}

type createCouponRequest struct {
	Code              string   `json:"code"`
	Name              string   `json:"name"`
	Category          string   `json:"category"`
	Description       *string  `json:"description"`
	DiscountType      string   `json:"discount_type"`
	DiscountValue     float64  `json:"discount_value"`
	MaxDiscountAmount *float64 `json:"max_discount_amount"`
	StartAt           string   `json:"start_at"`
	EndAt             *string  `json:"end_at"`
	ProductIDs        []string `json:"product_ids"`
	ProductMinQty     *int     `json:"product_min_qty"`
	ProductQtyLimit   *int     `json:"product_qty_limit"`
	MinOrderAmount    *float64 `json:"min_order_amount"`
	PerUserOnly       *bool    `json:"per_user_only"`
	CustomerID        *string  `json:"customer_id"`
	UsageLimit        *int     `json:"usage_limit"`
	UsageLimitPerUser *int     `json:"usage_limit_per_user"`
	IsActive          *bool    `json:"is_active"`
}

type updateCouponRequest struct {
	Code              *string   `json:"code"`
	Name              *string   `json:"name"`
	Category          *string   `json:"category"`
	Description       *string   `json:"description"`
	DiscountType      *string   `json:"discount_type"`
	DiscountValue     *float64  `json:"discount_value"`
	MaxDiscountAmount *float64  `json:"max_discount_amount"`
	StartAt           *string   `json:"start_at"`
	EndAt             *string   `json:"end_at"`
	ProductIDs        *[]string `json:"product_ids"`
	ProductMinQty     *int      `json:"product_min_qty"`
	ProductQtyLimit   *int      `json:"product_qty_limit"`
	MinOrderAmount    *float64  `json:"min_order_amount"`
	PerUserOnly       *bool     `json:"per_user_only"`
	CustomerID        *string   `json:"customer_id"`
	UsageLimit        *int      `json:"usage_limit"`
	UsageLimitPerUser *int      `json:"usage_limit_per_user"`
	IsActive          *bool     `json:"is_active"`
}

func (h *CouponHandler) Create(c *gin.Context) {
	var req createCouponRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Code) == "" || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code and name are required"})
		return
	}
	if req.DiscountValue < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "discount_value must be non-negative"})
		return
	}
	startAt, err := parseCouponTime(req.StartAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_at must be RFC3339"})
		return
	}
	endAt, err := parseOptionalCouponTime(req.EndAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end_at must be RFC3339"})
		return
	}
	productIDs := catalogservices.NormalizeCouponProductIDs(req.ProductIDs)
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	coupon := &catalogmodels.Coupon{
		ID:                id,
		Code:              strings.TrimSpace(req.Code),
		Name:              strings.TrimSpace(req.Name),
		Category:          normalizeCouponCategory(req.Category),
		Description:       trimCouponStringPtr(req.Description),
		DiscountType:      defaultCouponType(req.DiscountType),
		DiscountValue:     req.DiscountValue,
		MaxDiscountAmount: req.MaxDiscountAmount,
		StartAt:           startAt,
		EndAt:             endAt,
		ProductIDs:        productIDs,
		ProductMinQty:     req.ProductMinQty,
		ProductQtyLimit:   req.ProductQtyLimit,
		MinOrderAmount:    req.MinOrderAmount,
		PerUserOnly:       optCouponBoolValue(req.PerUserOnly, false),
		CustomerID:        trimCouponStringPtr(req.CustomerID),
		UsageLimit:        req.UsageLimit,
		UsageLimitPerUser: req.UsageLimitPerUser,
		IsActive:          optCouponBoolValue(req.IsActive, true),
	}
	if err := h.svc.CreateCoupon(c.Request.Context(), coupon); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, coupon)
}

func (h *CouponHandler) List(c *gin.Context) {
	isActive, err := parseCouponBoolQuery(c.Query("is_active"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid is_active"})
		return
	}
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 20)
	items, total, err := h.svc.ListCoupons(c.Request.Context(), catalogservices.CouponListFilter{
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

func (h *CouponHandler) GetByID(c *gin.Context) {
	coupon, err := h.svc.GetCouponByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "coupon not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, coupon)
}

func (h *CouponHandler) Update(c *gin.Context) {
	var req updateCouponRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := map[string]interface{}{}
	if req.Code != nil {
		if strings.TrimSpace(*req.Code) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "code cannot be empty"})
			return
		}
		updates["code"] = strings.TrimSpace(*req.Code)
	}
	if req.Name != nil {
		if strings.TrimSpace(*req.Name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
			return
		}
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Category != nil {
		updates["category"] = normalizeCouponCategory(*req.Category)
	}
	if req.Description != nil {
		updates["description"] = trimCouponStringPtr(req.Description)
	}
	if req.DiscountType != nil {
		updates["discount_type"] = defaultCouponType(*req.DiscountType)
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
	if req.StartAt != nil {
		start, err := parseCouponTime(*req.StartAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_at must be RFC3339"})
			return
		}
		updates["start_at"] = start
	}
	if req.EndAt != nil {
		end, err := parseOptionalCouponTime(req.EndAt)
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
		updates["customer_id"] = trimCouponStringPtr(req.CustomerID)
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
		if _, err := h.svc.UpdateCouponByID(c.Request.Context(), c.Param("id"), updates); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	if req.ProductIDs != nil {
		if err := h.svc.SetCouponProductIDs(c.Request.Context(), c.Param("id"), *req.ProductIDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	coupon, err := h.svc.GetCouponByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, coupon)
}

func (h *CouponHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteCouponByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "coupon not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

func defaultCouponType(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if trimmed == "" {
		return "percentage"
	}
	if trimmed != "percentage" && trimmed != "fixed" {
		return "percentage"
	}
	return trimmed
}

func normalizeCouponCategory(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	switch trimmed {
	case "product_discount", "product", "discount", "product/cart", "cart", "cart_discount":
		return "product_discount"
	case "total_discount", "total", "cart_total", "order", "order_discount":
		return "total_discount"
	case "shipping", "shipping_discount", "ongkir", "free_shipping", "gratis_ongkir":
		return "shipping_discount"
	case "cashback":
		return "cashback"
	default:
		return "product_discount"
	}
}

func parseCouponTime(value string) (time.Time, error) {
	return time.Parse(time.RFC3339, strings.TrimSpace(value))
}

func parseOptionalCouponTime(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*value))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func trimCouponStringPtr(v *string) *string {
	if v == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func parseCouponBoolQuery(v string) (*bool, error) {
	if strings.TrimSpace(v) == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func optCouponBoolValue(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}
