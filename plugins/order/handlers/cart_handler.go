package handlers

import (
	"net/http"
	"strings"

	authservices "go_framework/plugins/auth/services"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type CartHandler struct {
	svc      *ordersvc.CartService
	orderSvc *ordersvc.OrderService
	authSvc  *authservices.AuthService
}

func NewCartHandler(svc *ordersvc.CartService, orderSvc *ordersvc.OrderService, authSvc *authservices.AuthService) *CartHandler {
	return &CartHandler{svc: svc, orderSvc: orderSvc, authSvc: authSvc}
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

func (h *CartHandler) MePreview(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	var businessID *string
	if v := strings.TrimSpace(c.Query("business_id")); v != "" {
		businessID = &v
	}
	var coupon *string
	if v := strings.TrimSpace(c.Query("coupon_code")); v != "" {
		coupon = &v
	}
	preview, err := h.svc.PreviewCartForCustomer(c.Request.Context(), customerID, businessID, coupon)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": preview})
}

func (h *CartHandler) MeBusinesses(c *gin.Context) {
	customerID := customerIDFromContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	rows, err := h.svc.ListCartBusinessesByCustomer(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
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
		Currency   string  `json:"currency"`
		CouponCode *string `json:"coupon_code"`
		AddressID  *string `json:"address_id"`
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
	var shippingAddress *ordersvc.ShippingAddressSnapshot
	if h.authSvc != nil {
		var addrID string
		if req.AddressID != nil {
			addrID = strings.TrimSpace(*req.AddressID)
		}
		var addrErr error
		if addrID != "" {
			if addr, err := h.authSvc.GetCustomerAddressByID(c.Request.Context(), customerID, addrID); err == nil {
				shippingAddress = &ordersvc.ShippingAddressSnapshot{
					AddressID:    addr.ID,
					Label:        addr.Label,
					ReceiverName: addr.ReceiverName,
					PhoneNumber:  addr.PhoneNumber,
					AddressLine1: addr.AddressLine1,
					AddressLine2: addr.AddressLine2,
					Subdistrict:  addr.Subdistrict,
					District:     addr.District,
					City:         addr.City,
					Province:     addr.Province,
					PostalCode:   addr.PostalCode,
					Country:      addr.Country,
					Notes:        addr.Notes,
					IsPrimary:    addr.IsPrimary,
					AddressString: strings.TrimSpace(strings.Join([]string{
						addr.AddressLine1,
						valueOrEmpty(addr.AddressLine2),
						valueOrEmpty(addr.Subdistrict),
						valueOrEmpty(addr.District),
						addr.City,
						addr.Province,
						addr.PostalCode,
					}, ", ")),
				}
			} else {
				addrErr = err
			}
		} else if addr, err := h.authSvc.GetPrimaryCustomerAddress(c.Request.Context(), customerID); err == nil {
			shippingAddress = &ordersvc.ShippingAddressSnapshot{
				AddressID:    addr.ID,
				Label:        addr.Label,
				ReceiverName: addr.ReceiverName,
				PhoneNumber:  addr.PhoneNumber,
				AddressLine1: addr.AddressLine1,
				AddressLine2: addr.AddressLine2,
				Subdistrict:  addr.Subdistrict,
				District:     addr.District,
				City:         addr.City,
				Province:     addr.Province,
				PostalCode:   addr.PostalCode,
				Country:      addr.Country,
				Notes:        addr.Notes,
				IsPrimary:    addr.IsPrimary,
				AddressString: strings.TrimSpace(strings.Join([]string{
					addr.AddressLine1,
					valueOrEmpty(addr.AddressLine2),
					valueOrEmpty(addr.Subdistrict),
					valueOrEmpty(addr.District),
					addr.City,
					addr.Province,
					addr.PostalCode,
				}, ", ")),
			}
		} else {
			addrErr = err
		}
		if addrErr != nil && req.AddressID != nil && strings.TrimSpace(*req.AddressID) != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "shipping address not found"})
			return
		}
	}
	if shippingAddress == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "shipping address is required"})
		return
	}
	ord, err := h.orderSvc.CheckoutCart(c.Request.Context(), cart.ID, req.Currency, req.CouponCode, shippingAddress)
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
	ord, err := h.orderSvc.CheckoutCart(c.Request.Context(), cartID, req.Currency, nil, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ord})
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
