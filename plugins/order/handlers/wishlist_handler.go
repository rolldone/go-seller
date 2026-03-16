package handlers

import (
	"net/http"

	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type WishlistHandler struct {
	svc *ordersvc.WishlistService
}

func NewWishlistHandler(svc *ordersvc.WishlistService) *WishlistHandler {
	return &WishlistHandler{svc: svc}
}

type createWishlistReq struct {
	UserID     string  `json:"user_id" binding:"required"`
	BusinessID *string `json:"business_id"`
}

type addWishlistItemReq struct {
	ProductID string `json:"product_id" binding:"required"`
}

func (h *WishlistHandler) Create(c *gin.Context) {
	var req createWishlistReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	w, err := h.svc.CreateWishlist(c.Request.Context(), req.UserID, req.BusinessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": w})
}

func (h *WishlistHandler) AddItem(c *gin.Context) {
	wishlistID := c.Param("id")
	var req addWishlistItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	it, err := h.svc.AddItem(c.Request.Context(), wishlistID, req.ProductID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": it})
}

func (h *WishlistHandler) Get(c *gin.Context) {
	wishlistID := c.Param("id")
	w, items, err := h.svc.GetWishlist(c.Request.Context(), wishlistID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"wishlist": w, "items": items}})
}
