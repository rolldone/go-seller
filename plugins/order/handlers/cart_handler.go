package handlers

import (
	"net/http"
	"strings"

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
	CustomerID string  `json:"customer_id"`
	BusinessID *string `json:"business_id"`
}

type addItemReq struct {
	ProductID    string  `json:"product_id" binding:"required"`
	ProductName  string  `json:"product_name"`
	BusinessID   *string `json:"business_id"`
	BusinessName string  `json:"business_name"`
	VariationID  *string `json:"variation_id"`
	SKU          *string `json:"sku"`
	ImageURL     *string `json:"image_url"`
	Qty          int     `json:"qty" binding:"required"`
	UnitPrice    float64 `json:"unit_price" binding:"required"`
}

type updateCartItemReq struct {
	Qty int `json:"qty" binding:"required"`
}

func customerIDFromContext(c *gin.Context) string {
	return strings.TrimSpace(c.GetString("customer_id"))
}

func (h *CartHandler) Create(c *gin.Context) {
	var req createCartReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ownerID := strings.TrimSpace(req.CustomerID)
	if ownerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "customer_id is required"})
		return
	}
	cart, err := h.svc.CreateCart(c.Request.Context(), ownerID, req.BusinessID)
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

func (h *CartHandler) Me(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	var businessID *string
	if v := strings.TrimSpace(c.Query("business_id")); v != "" {
		businessID = &v
	}
	cart, items, err := h.svc.GetCartWithItemsByCustomer(c.Request.Context(), customerID, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"cart": cart, "items": items}})
}

func (h *CartHandler) MeAddItem(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	var req addItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cart, items, item, err := h.svc.AddItemToCustomerCart(c.Request.Context(), customerID, ordersvc.CartItemSnapshot{
		ProductID:    req.ProductID,
		ProductName:  req.ProductName,
		BusinessID:   req.BusinessID,
		BusinessName: req.BusinessName,
		VariationID:  req.VariationID,
		SKU:          req.SKU,
		ImageURL:     req.ImageURL,
		Qty:          req.Qty,
		UnitPrice:    req.UnitPrice,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"cart": cart, "items": items, "item": item}})
}

func (h *CartHandler) MeUpdateItem(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	var req updateCartItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cart, items, item, err := h.svc.UpdateCartItemQtyByCustomer(c.Request.Context(), customerID, c.Param("item_id"), req.Qty)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"cart": cart, "items": items, "item": item}})
}

func (h *CartHandler) MeDeleteItem(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	cart, items, err := h.svc.DeleteCartItemByCustomer(c.Request.Context(), customerID, c.Param("item_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"cart": cart, "items": items}})
}

func (h *CartHandler) MeCheckout(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	var businessID *string
	if v := strings.TrimSpace(c.Query("business_id")); v != "" {
		businessID = &v
	}
	var req struct {
		Currency string `json:"currency"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cart, _, err := h.svc.GetCartWithItemsByCustomer(c.Request.Context(), customerID, businessID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.orderSvc.CheckoutCart(c.Request.Context(), cart.ID, req.Currency)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ord})
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
