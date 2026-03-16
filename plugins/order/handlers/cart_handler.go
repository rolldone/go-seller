package handlers

import (
	"net/http"

	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type CartHandler struct {
	svc      *ordersvc.CartService
	orderSvc *ordersvc.OrderService
}

func NewCartHandler(svc *ordersvc.CartService, orderSvc *ordersvc.OrderService) *CartHandler {
	return &CartHandler{svc: svc, orderSvc: orderSvc}
}

type createCartReq struct {
	UserID     string  `json:"user_id" binding:"required"`
	BusinessID *string `json:"business_id"`
}

type addItemReq struct {
	ProductID string  `json:"product_id" binding:"required"`
	Qty       int     `json:"qty" binding:"required"`
	UnitPrice float64 `json:"unit_price" binding:"required"`
}

func (h *CartHandler) Create(c *gin.Context) {
	var req createCartReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cart, err := h.svc.CreateCart(c.Request.Context(), req.UserID, req.BusinessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": cart})
}

func (h *CartHandler) AddItem(c *gin.Context) {
	cartID := c.Param("id")
	var req addItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.AddItemToCart(c.Request.Context(), cartID, req.ProductID, req.Qty, req.UnitPrice)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h *CartHandler) Get(c *gin.Context) {
	cartID := c.Param("id")
	cart, items, err := h.svc.GetCartWithItems(c.Request.Context(), cartID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"cart": cart, "items": items}})
}

func (h *CartHandler) Checkout(c *gin.Context) {
	cartID := c.Param("id")
	var req struct {
		Currency string `json:"currency" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.orderSvc.CheckoutCart(c.Request.Context(), cartID, req.Currency)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ord})
}
