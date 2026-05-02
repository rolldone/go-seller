package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SellerBalanceHandler struct {
	SellerBalanceService *services.SellerBalanceService
}

func NewSellerBalanceHandler(sbService *services.SellerBalanceService) *SellerBalanceHandler {
	return &SellerBalanceHandler{
		SellerBalanceService: sbService,
	}
}

// AdminGetSummary retrieves seller balance summary for admin
// GET /admin/order/seller-balance/summary
func (h *SellerBalanceHandler) AdminGetSummary(c *gin.Context) {
	summary, err := h.SellerBalanceService.GetAdminSummary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"summary": summary})
}

// GetBalance retrieves current seller balance
// GET /member/businesses/:business_id/balance
func (h *SellerBalanceHandler) GetBalance(c *gin.Context) {
	sellerID := c.Param("business_id")
	if sellerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seller id"})
		return
	}

	balance, err := h.SellerBalanceService.GetSellerBalance(c.Request.Context(), sellerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "balance not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, balance)
}

// ListMutations retrieves mutation history for a seller
// GET /member/businesses/:business_id/balance/mutations
func (h *SellerBalanceHandler) ListMutations(c *gin.Context) {
	sellerID := c.Param("business_id")
	if sellerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seller id"})
		return
	}

	// Get pagination params
	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if p := c.Query("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			offset = (parsed - 1) * limit
		}
	}

	mutations, total, err := h.SellerBalanceService.GetMutations(c.Request.Context(), sellerID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  mutations,
		"total": total,
		"limit": limit,
		"page":  (offset / limit) + 1,
	})
}

// AdminCreditBalance adds credit to seller balance (admin function)
// POST /admin/order/seller-balance/:seller_id/credit
func (h *SellerBalanceHandler) AdminCreditBalance(c *gin.Context) {
	sellerID := c.Param("seller_id")
	if sellerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seller id"})
		return
	}

	var req struct {
		Amount      int64   `json:"amount" binding:"required,gt=0"`
		Source      string  `json:"source" binding:"required"`
		Description *string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mutation, err := h.SellerBalanceService.CreditBalance(
		c.Request.Context(),
		sellerID,
		req.Amount,
		req.Source,
		nil,
		nil,
		req.Description,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, mutation)
}

// AdminDebetBalance deducts from seller balance (admin function)
// POST /admin/order/seller-balance/:seller_id/debet
func (h *SellerBalanceHandler) AdminDebetBalance(c *gin.Context) {
	sellerID := c.Param("seller_id")
	if sellerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seller id"})
		return
	}

	var req struct {
		Amount      int64   `json:"amount" binding:"required,gt=0"`
		Source      string  `json:"source" binding:"required"`
		Description *string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mutation, err := h.SellerBalanceService.DebetBalance(
		c.Request.Context(),
		sellerID,
		req.Amount,
		req.Source,
		nil,
		nil,
		req.Description,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, mutation)
}
