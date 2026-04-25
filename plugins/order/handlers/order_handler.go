package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	authservices "go_framework/plugins/auth/services"
	catalogservices "go_framework/plugins/catalog/services"
	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type OrderHandler struct {
	svc        *ordersvc.OrderService
	paymentSvc *ordersvc.PaymentService
	catalogSvc *catalogservices.CatalogService
	authSvc    *authservices.AuthService
}

func NewOrderHandler(svc *ordersvc.OrderService, paymentSvc *ordersvc.PaymentService, catalogSvc *catalogservices.CatalogService, authSvc *authservices.AuthService) *OrderHandler {
	return &OrderHandler{svc: svc, paymentSvc: paymentSvc, catalogSvc: catalogSvc, authSvc: authSvc}
}

type publicBusinessSummary struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Slug             string  `json:"slug"`
	ShortDescription *string `json:"short_description,omitempty"`
}

func (h *OrderHandler) loadBusinessSummary(ctx context.Context, businessID *string) (*publicBusinessSummary, error) {
	if h == nil || h.catalogSvc == nil || businessID == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*businessID)
	if trimmed == "" {
		return nil, nil
	}
	business, err := h.catalogSvc.GetBusinessByID(ctx, trimmed)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &publicBusinessSummary{
		ID:               business.ID,
		Name:             business.Name,
		Slug:             business.Slug,
		ShortDescription: business.ShortDescription,
	}, nil
}

// orderToPublic converts internal Order model to a map suitable for public JSON responses,
// decoding the JSONB `Metadata` field into a native object when possible.
func orderToPublic(ord *ordermodels.Order) gin.H {
	// safe nil handling
	if ord == nil {
		return gin.H{}
	}
	var metadata any = nil
	if len(ord.Metadata) > 0 && !strings.EqualFold(strings.TrimSpace(string(ord.Metadata)), "null") {
		var md any
		if err := json.Unmarshal(ord.Metadata, &md); err == nil {
			metadata = md
		}
	}
	return gin.H{
		"id":               ord.ID,
		"order_number":     ord.OrderNumber,
		"user_id":          ord.UserID,
		"customer_id":      ord.CustomerID,
		"business_id":      ord.BusinessID,
		"channel":          ord.Channel,
		"status":           ord.Status,
		"payment_status":   ord.PaymentStatus,
		"currency":         ord.Currency,
		"subtotal":         ord.Subtotal,
		"discount_amount":  ord.DiscountAmount,
		"tax_amount":       ord.TaxAmount,
		"shipping_amount":  ord.ShippingAmount,
		"fulfillment_type": ord.FulfillmentType,
		"grand_total":      ord.GrandTotal,
		"applied_coupons":  ord.OrderCoupons,
		"notes":            ord.Notes,
		"metadata":         metadata,
		"placed_at":        ord.PlacedAt,
		"paid_at":          ord.PaidAt,
		"cancelled_at":     ord.CancelledAt,
		"created_at":       ord.CreatedAt,
		"updated_at":       ord.UpdatedAt,
		"order_items":      ord.OrderItems,
	}
}

type adminCreateOrderReq struct {
	AdminID         string  `json:"admin_id" binding:"required"`
	UserID          *string `json:"user_id"`
	CustomerID      *string `json:"customer_id"`
	BusinessID      *string `json:"business_id"`
	FulfillmentType string  `json:"fulfillment_type"`
	Currency        string  `json:"currency" binding:"required"`
	IsDraft         bool    `json:"is_draft"`
	Items           []struct {
		ProductID string  `json:"product_id" binding:"required"`
		Qty       int     `json:"qty" binding:"required"`
		UnitPrice float64 `json:"unit_price" binding:"required"`
	} `json:"items"`
}

func (h *OrderHandler) AdminCreate(c *gin.Context) {
	var req adminCreateOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	items := make([]ordermodels.OrderItem, 0, len(req.Items))
	now := time.Now()
	for _, it := range req.Items {
		items = append(items, ordermodels.OrderItem{
			ID:        "",
			ProductID: &it.ProductID,
			Qty:       it.Qty,
			UnitPrice: it.UnitPrice,
			LineTotal: float64(it.Qty) * it.UnitPrice,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
	if req.IsDraft || len(items) == 0 {
		ord, err := h.svc.CreateDraftOrderAsAdmin(c.Request.Context(), req.AdminID, req.UserID, req.CustomerID, req.BusinessID, req.FulfillmentType, req.Currency)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"data": ord})
		return
	}

	ord, err := h.svc.CreateOrderAsAdmin(c.Request.Context(), req.AdminID, req.UserID, req.CustomerID, req.BusinessID, req.FulfillmentType, items, req.Currency)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ord})
}

type addOrderItemReq struct {
	ProductID      *string `json:"product_id"`
	ProductName    string  `json:"product_name"`
	SKU            *string `json:"sku"`
	Qty            int     `json:"qty" binding:"required"`
	UnitPrice      float64 `json:"unit_price" binding:"required"`
	DiscountAmount float64 `json:"discount_amount"`
}

type applyOrderItemDiscountReq struct {
	DiscountID string `json:"discount_id" binding:"required"`
}

type updateShippingAddressReq struct {
	AddressID string `json:"address_id" binding:"required"`
}

func (h *OrderHandler) AdminUpdateShippingAddress(c *gin.Context) {
	if h.authSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth service not configured"})
		return
	}

	var req updateShippingAddressReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ord, err := h.svc.GetOrderByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if ord.CustomerID == nil || strings.TrimSpace(*ord.CustomerID) == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "order customer is required"})
		return
	}

	addr, err := h.authSvc.GetCustomerAddressByID(c.Request.Context(), strings.TrimSpace(*ord.CustomerID), req.AddressID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "address not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.svc.UpdateShippingAddress(c.Request.Context(), ord.ID, *shippingAddressSnapshotFromCustomerAddress(addr))
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) || errors.Is(err, ordersvc.ErrShippingAddressLocked) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(updated)})
}

func (h *OrderHandler) AddItem(c *gin.Context) {
	orderID := c.Param("id")
	var req addOrderItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Qty <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "qty must be greater than zero"})
		return
	}
	if req.UnitPrice < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unit_price must be non-negative"})
		return
	}

	item := ordermodels.OrderItem{
		ProductID:      req.ProductID,
		ProductName:    req.ProductName,
		SKU:            req.SKU,
		Qty:            req.Qty,
		UnitPrice:      req.UnitPrice,
		DiscountAmount: req.DiscountAmount,
	}
	created, err := h.svc.AddItemToOrder(c.Request.Context(), orderID, item)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": created})
}

func (h *OrderHandler) DeleteItem(c *gin.Context) {
	orderID := c.Param("id")
	itemID := c.Param("item_id")
	if err := h.svc.RemoveOrderItem(c.Request.Context(), orderID, itemID); err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *OrderHandler) ApplyItemDiscount(c *gin.Context) {
	orderID := c.Param("id")
	itemID := c.Param("item_id")
	var req applyOrderItemDiscountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.ApplyDiscountToOrderItem(c.Request.Context(), orderID, itemID, req.DiscountID)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

func (h *OrderHandler) RemoveItemDiscount(c *gin.Context) {
	orderID := c.Param("id")
	itemID := c.Param("item_id")
	ord, err := h.svc.RemoveDiscountFromOrderItem(c.Request.Context(), orderID, itemID)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

func (h *OrderHandler) Finalize(c *gin.Context) {
	orderID := c.Param("id")
	ord, err := h.svc.FinalizeOrder(c.Request.Context(), orderID)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

type applyCouponReq struct {
	CouponCode string `json:"coupon_code" binding:"required"`
}

func (h *OrderHandler) ApplyCoupon(c *gin.Context) {
	orderID := c.Param("id")
	var req applyCouponReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.ApplyCouponToOrder(c.Request.Context(), orderID, req.CouponCode)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, ordersvc.ErrDuplicateCouponCategory) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

// RemoveCoupon removes a specific coupon from the order by code (:code URL param).
func (h *OrderHandler) RemoveCoupon(c *gin.Context) {
	orderID := c.Param("id")
	couponCode := c.Param("code")
	ord, err := h.svc.RemoveCouponFromOrder(c.Request.Context(), orderID, couponCode)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

type updateOrderReq struct {
	CustomerID      *string `json:"customer_id"`
	FulfillmentType *string `json:"fulfillment_type"`
}

func (h *OrderHandler) Update(c *gin.Context) {
	orderID := c.Param("id")
	var req updateOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.UpdateOrderCustomerAndFulfillment(c.Request.Context(), orderID, req.CustomerID, req.FulfillmentType)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

type updateOrderStatusReq struct {
	Status string `json:"status" binding:"required"`
}

type updateShippingQuoteReq struct {
	ShippingAmount    float64 `json:"shipping_amount" binding:"required"`
	CarrierName       string  `json:"carrier_name"`
	ServiceName       string  `json:"service_name"`
	TrackingNumber    string  `json:"tracking_number"`
	EstimatedDelivery string  `json:"estimated_delivery"`
	Description       string  `json:"description"`
	Notes             string  `json:"notes"`
}

// SetStatus allows admins to set the order status directly.
func (h *OrderHandler) SetStatus(c *gin.Context) {
	orderID := c.Param("id")
	var req updateOrderStatusReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.UpdateOrderStatus(c.Request.Context(), orderID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

// UpdateShippingQuote stores/updates ongkir details; tracking number can be updated later using the same endpoint.
func (h *OrderHandler) UpdateShippingQuote(c *gin.Context) {
	orderID := c.Param("id")
	var req updateShippingQuoteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.UpdateShippingQuote(c.Request.Context(), orderID, ordersvc.ShippingQuoteDetails{
		ShippingAmount:    req.ShippingAmount,
		CarrierName:       req.CarrierName,
		ServiceName:       req.ServiceName,
		TrackingNumber:    req.TrackingNumber,
		EstimatedDelivery: req.EstimatedDelivery,
		Description:       req.Description,
		Notes:             req.Notes,
	})
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ord})
}

func (h *OrderHandler) GetByID(c *gin.Context) {
	id := c.Param("id")
	ord, err := h.svc.GetOrderByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	business, err := h.loadBusinessSummary(c.Request.Context(), ord.BusinessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"order": orderToPublic(ord), "payments": ord.Payments, "business": business}})
}

func (h *OrderHandler) MeGetByID(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	ord, err := h.svc.GetOrderByIDForCustomer(c.Request.Context(), c.Param("id"), customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	business, err := h.loadBusinessSummary(c.Request.Context(), ord.BusinessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var businessIDPtr *string
	if ord.BusinessID != nil && strings.TrimSpace(*ord.BusinessID) != "" {
		businessID := strings.TrimSpace(*ord.BusinessID)
		businessIDPtr = &businessID
	}
	providers, err := h.paymentSvc.ListProviders(c.Request.Context(), ordersvc.PaymentProviderFilter{BusinessID: businessIDPtr, IncludeInactive: false})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	providerResp := make([]gin.H, 0, len(providers))
	for _, p := range providers {
		config := map[string]any{}
		if strings.EqualFold(strings.TrimSpace(p.ProviderKey), "bank_transfer") {
			config = parseProviderPublicConfig(p.Config)
		}
		providerResp = append(providerResp, gin.H{
			"id":           p.ID,
			"name":         p.Name,
			"provider_key": p.ProviderKey,
			"is_active":    p.IsActive,
			"is_used":      p.IsUsed,
			"config":       config,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"order": orderToPublic(ord), "payments": ord.Payments, "providers": providerResp, "business": business}})
}

func (h *OrderHandler) MeList(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	page := 1
	limit := 20
	if p := strings.TrimSpace(c.Query("page")); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := strings.TrimSpace(c.Query("limit")); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}

	filter := ordersvc.OrderListFilter{
		Query:         c.Query("q"),
		BusinessID:    c.Query("business_id"),
		CustomerID:    customerID,
		Status:        c.Query("status"),
		PaymentStatus: c.Query("payment_status"),
		Channel:       c.Query("channel"),
		Page:          page,
		Limit:         limit,
		Sort:          c.Query("sort"),
	}
	orders, total, err := h.svc.ListOrders(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders, "total": total})
}

func (h *OrderHandler) MeUpdateShippingAddress(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	if h.authSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth service not configured"})
		return
	}

	var req updateShippingAddressReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ord, err := h.svc.GetOrderByIDForCustomer(c.Request.Context(), c.Param("id"), customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	addr, err := h.authSvc.GetCustomerAddressByID(c.Request.Context(), customerID, req.AddressID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "address not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.svc.UpdateShippingAddress(c.Request.Context(), ord.ID, *shippingAddressSnapshotFromCustomerAddress(addr))
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) || errors.Is(err, ordersvc.ErrShippingAddressLocked) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(updated)})
}

func (h *OrderHandler) MeStartPayment(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	req, isMultipart, err := parseGuestStartPaymentReq(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ord, err := h.svc.GetOrderByIDForCustomer(c.Request.Context(), c.Param("id"), customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if strings.EqualFold(ord.Status, "expired") || strings.EqualFold(ord.PaymentStatus, "expired") {
		c.JSON(http.StatusConflict, gin.H{"error": "order expired"})
		return
	}
	if !ordersvc.HasShippingAddress(ord) {
		c.JSON(http.StatusConflict, gin.H{"error": "shipping address is required"})
		return
	}
	if strings.EqualFold(ord.Status, "awaiting_shipping") || strings.EqualFold(ord.Status, "pending_shipping") || strings.EqualFold(ord.Status, "awaiting_quote") ||
		strings.EqualFold(ord.PaymentStatus, "awaiting_shipping") || strings.EqualFold(ord.PaymentStatus, "pending_shipping") || strings.EqualFold(ord.PaymentStatus, "awaiting_quote") {
		c.JSON(http.StatusConflict, gin.H{"error": "shipping quote is pending; we will contact you via WhatsApp"})
		return
	}
	if strings.EqualFold(ord.Channel, "web") && (strings.EqualFold(ord.Status, "pending") || strings.EqualFold(ord.PaymentStatus, "unpaid")) && !ordersvc.HasReadyShippingQuote(ord) {
		c.JSON(http.StatusConflict, gin.H{"error": "shipping quote is pending; we will contact you via WhatsApp"})
		return
	}
	if strings.EqualFold(ord.PaymentStatus, "paid") || ord.PaidAt != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "order already paid"})
		return
	}

	var selectedProvider *ordermodels.PaymentProvider
	if req.ProviderID != nil && strings.TrimSpace(*req.ProviderID) != "" {
		item, getErr := h.paymentSvc.GetProviderByID(c.Request.Context(), strings.TrimSpace(*req.ProviderID))
		if getErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "payment provider not found"})
			return
		}
		selectedProvider = item
	} else if req.ProviderKey != nil && strings.TrimSpace(*req.ProviderKey) != "" {
		var businessIDPtr *string
		if ord.BusinessID != nil && strings.TrimSpace(*ord.BusinessID) != "" {
			bid := strings.TrimSpace(*ord.BusinessID)
			businessIDPtr = &bid
		}
		items, listErr := h.paymentSvc.ListProviders(c.Request.Context(), ordersvc.PaymentProviderFilter{BusinessID: businessIDPtr, IncludeInactive: false})
		if listErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": listErr.Error()})
			return
		}
		providerKey := strings.ToLower(strings.TrimSpace(*req.ProviderKey))
		for i := range items {
			if strings.ToLower(strings.TrimSpace(items[i].ProviderKey)) == providerKey {
				selectedProvider = &items[i]
				break
			}
		}
	}

	if selectedProvider == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider_id or provider_key is required"})
		return
	}
	if !selectedProvider.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment provider is inactive"})
		return
	}
	if selectedProvider.BusinessID != nil && ord.BusinessID != nil && strings.TrimSpace(*selectedProvider.BusinessID) != strings.TrimSpace(*ord.BusinessID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider business mismatch"})
		return
	}

	providerID := selectedProvider.ID
	providerKey := selectedProvider.ProviderKey
	providerKeyLower := strings.ToLower(strings.TrimSpace(providerKey))
	paymentMethod := providerKey
	gatewayName := providerKey
	if req.PaymentMethod != nil && strings.TrimSpace(*req.PaymentMethod) != "" {
		paymentMethod = strings.TrimSpace(*req.PaymentMethod)
	}
	if req.GatewayName != nil && strings.TrimSpace(*req.GatewayName) != "" {
		gatewayName = strings.TrimSpace(*req.GatewayName)
	}

	metadata := map[string]any{
		"source":      "customer_order",
		"customer_id": customerID,
	}
	for k, v := range req.Metadata {
		metadata[k] = v
	}
	if providerKeyLower == "bank_transfer" {
		if !isMultipart {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bank transfer requires multipart form-data with proof upload"})
			return
		}
		if req.SenderBank == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sender bank information is required for bank transfer"})
			return
		}
		if strings.TrimSpace(req.SenderBank.BankName) == "" || strings.TrimSpace(req.SenderBank.AccountNumber) == "" || strings.TrimSpace(req.SenderBank.AccountHolder) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sender bank fields are required"})
			return
		}

		transferAmount := ord.GrandTotal
		transferredAt := time.Now().UTC().Format(time.RFC3339)
		reference := ""
		if req.Transfer != nil {
			if req.Transfer.Amount > 0 {
				transferAmount = req.Transfer.Amount
			}
			if strings.TrimSpace(req.Transfer.TransferredAt) != "" {
				transferredAt = strings.TrimSpace(req.Transfer.TransferredAt)
			}
			reference = strings.TrimSpace(req.Transfer.Reference)
		}

		metadata["bank_transfer"] = map[string]any{
			"sender_bank": map[string]any{
				"bank_name":      strings.TrimSpace(req.SenderBank.BankName),
				"account_number": strings.TrimSpace(req.SenderBank.AccountNumber),
				"account_holder": strings.TrimSpace(req.SenderBank.AccountHolder),
			},
			"destination_bank": parseProviderPublicConfig(selectedProvider.Config),
			"transfer": map[string]any{
				"amount":         transferAmount,
				"transferred_at": transferredAt,
				"reference":      reference,
			},
		}
	}
	metadataJSON, _ := json.Marshal(metadata)

	cancelReason := "replaced by new customer order payment"
	if err := h.paymentSvc.CancelPendingPaymentsByOrder(c.Request.Context(), ord.ID, "customer", &customerID, &cancelReason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	payment := &ordermodels.Payment{
		OrderID:       ord.ID,
		Amount:        ord.GrandTotal,
		Currency:      ord.Currency,
		ProviderID:    &providerID,
		ProviderKey:   &providerKey,
		PaymentMethod: &paymentMethod,
		GatewayName:   &gatewayName,
		Status:        string(ordersvc.StatusPending),
		ProofStatus:   "none",
		Metadata:      metadataJSON,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if err := h.paymentSvc.CreatePayment(c.Request.Context(), payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if providerKeyLower == "bank_transfer" {
		mform, mErr := c.MultipartForm()
		if mErr != nil {
			_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
			c.JSON(http.StatusBadRequest, gin.H{"error": "proof file is required for bank transfer"})
			return
		}
		files := mform.File["proof"]
		if len(files) == 0 {
			_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
			c.JSON(http.StatusBadRequest, gin.H{"error": "proof file is required for bank transfer"})
			return
		}
		for _, fh := range files {
			if _, uploadErr := h.paymentSvc.UploadPaymentProofAsGuest(c.Request.Context(), payment.ID, customerID, fh, req.ProofNotes); uploadErr != nil {
				_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
				c.JSON(http.StatusBadRequest, gin.H{"error": uploadErr.Error()})
				return
			}
		}
		_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Where("id = ?", payment.ID).First(payment).Error
	}

	c.JSON(http.StatusCreated, gin.H{"data": payment})
}

func (h *OrderHandler) MeDownloadInvoice(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	orderID := c.Param("id")
	if _, err := h.svc.GetOrderByIDForCustomer(c.Request.Context(), orderID, customerID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pdfBytes, filename, err := h.svc.GenerateInvoicePDF(c.Request.Context(), orderID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "record not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		if errors.Is(err, ordersvc.ErrInvoiceRenderFailed) {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (h *OrderHandler) MeListPaymentProofs(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	orderID := strings.TrimSpace(c.Param("id"))
	paymentID := strings.TrimSpace(c.Param("payment_id"))
	if orderID == "" || paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id and payment_id are required"})
		return
	}

	order, err := h.svc.GetOrderByIDForCustomer(c.Request.Context(), orderID, customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	paymentOwned := false
	for _, payment := range order.Payments {
		if strings.TrimSpace(payment.ID) == paymentID {
			paymentOwned = true
			break
		}
	}
	if !paymentOwned {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	proofs, err := h.paymentSvc.ListPaymentProofs(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": proofs})
}

func (h *OrderHandler) MePaymentProofAccess(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	orderID := strings.TrimSpace(c.Param("id"))
	paymentID := strings.TrimSpace(c.Param("payment_id"))
	proofID := strings.TrimSpace(c.Param("proof_id"))
	if orderID == "" || paymentID == "" || proofID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id, payment_id, and proof_id are required"})
		return
	}

	order, err := h.svc.GetOrderByIDForCustomer(c.Request.Context(), orderID, customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	paymentOwned := false
	for _, payment := range order.Payments {
		if strings.TrimSpace(payment.ID) == paymentID {
			paymentOwned = true
			break
		}
	}
	if !paymentOwned {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	var proof ordermodels.PaymentProof
	if err := h.paymentSvc.DB.WithContext(c.Request.Context()).Where("id = ? AND payment_id = ? AND deleted_at IS NULL", proofID, paymentID).First(&proof).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "proof not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if h.paymentSvc.Store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage not configured"})
		return
	}
	if strings.TrimSpace(proof.StorageKey) == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no storage key for proof"})
		return
	}

	rc, err := h.paymentSvc.Store.Get(c.Request.Context(), proof.StorageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "failed to retrieve proof from storage"})
		return
	}
	defer rc.Close()

	if proof.MimeType != "" {
		c.Header("Content-Type", proof.MimeType)
	} else {
		c.Header("Content-Type", "application/octet-stream")
	}
	if proof.FileSize > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", proof.FileSize))
	}
	filename := proof.StorageKey
	if idx := strings.LastIndex(proof.StorageKey, "/"); idx >= 0 && idx+1 < len(proof.StorageKey) {
		filename = proof.StorageKey[idx+1:]
	}
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", filename))

	if _, err := io.Copy(c.Writer, rc); err != nil {
		c.Error(err)
		return
	}
}

func (h *OrderHandler) DownloadInvoice(c *gin.Context) {
	id := c.Param("id")
	pdfBytes, filename, err := h.svc.GenerateInvoicePDF(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "record not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		if errors.Is(err, ordersvc.ErrInvoiceRenderFailed) {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (h *OrderHandler) AdminList(c *gin.Context) {
	// parse filters
	page := 1
	limit := 20
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	var fromPtr *time.Time
	var toPtr *time.Time
	// flexible date parsing: try RFC3339 then YYYY-MM-DD
	parseFlexible := func(s string) (*time.Time, error) {
		if s == "" {
			return nil, nil
		}
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			return &t, nil
		}
		if t, err := time.Parse("2006-01-02", s); err == nil {
			// treat as start of day
			st := t
			return &st, nil
		}
		return nil, nil
	}
	if v := c.Query("from"); v != "" {
		if t, _ := parseFlexible(v); t != nil {
			fromPtr = t
		}
	}
	if v := c.Query("to"); v != "" {
		if t, _ := parseFlexible(v); t != nil {
			toPtr = t
		}
	}
	filter := ordersvc.OrderListFilter{
		Query:         c.Query("q"),
		BusinessID:    c.Query("business_id"),
		UserID:        c.Query("user_id"),
		Status:        c.Query("status"),
		PaymentStatus: c.Query("payment_status"),
		Channel:       c.Query("channel"),
		From:          fromPtr,
		To:            toPtr,
		Page:          page,
		Limit:         limit,
		Sort:          c.Query("sort"),
	}
	orders, total, err := h.svc.ListOrders(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders, "total": total})
}
