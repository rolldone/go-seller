package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	svc *ordersvc.OrderService
}

func NewOrderHandler(svc *ordersvc.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

type adminCreateOrderReq struct {
	AdminID    string  `json:"admin_id" binding:"required"`
	UserID     *string `json:"user_id"`
	CustomerID *string `json:"customer_id"`
	BusinessID *string `json:"business_id"`
	Currency   string  `json:"currency" binding:"required"`
	IsDraft    bool    `json:"is_draft"`
	Items      []struct {
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
		ord, err := h.svc.CreateDraftOrderAsAdmin(c.Request.Context(), req.AdminID, req.UserID, req.CustomerID, req.BusinessID, req.Currency)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"data": ord})
		return
	}

	ord, err := h.svc.CreateOrderAsAdmin(c.Request.Context(), req.AdminID, req.UserID, req.CustomerID, req.BusinessID, items, req.Currency)
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
	CustomerID *string `json:"customer_id"`
}

func (h *OrderHandler) Update(c *gin.Context) {
	orderID := c.Param("id")
	var req updateOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.UpdateOrderCustomer(c.Request.Context(), orderID, req.CustomerID)
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

func (h *OrderHandler) GetByID(c *gin.Context) {
	id := c.Param("id")
	ord, err := h.svc.GetOrderByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"order": ord, "payments": ord.Payments}})
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
