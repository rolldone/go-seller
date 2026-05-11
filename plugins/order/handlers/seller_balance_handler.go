package handlers

import (
	"errors"
	"net/http"
	"strconv"

	catalogservices "go_framework/plugins/catalog/services"
	"go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SellerBalanceHandler struct {
	SellerBalanceService *services.SellerBalanceService
	CatalogService       *catalogservices.CatalogService
}

func NewSellerBalanceHandler(sbService *services.SellerBalanceService, catalogService *catalogservices.CatalogService) *SellerBalanceHandler {
	return &SellerBalanceHandler{
		SellerBalanceService: sbService,
		CatalogService:       catalogService,
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
	if _, ok := memberBusinessAccess(c, h.CatalogService, sellerID); !ok {
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
	if _, ok := memberBusinessAccess(c, h.CatalogService, sellerID); !ok {
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

// MemberSettlementSummary returns settlement totals for the current member business.
// GET /member/businesses/:business_id/balance/settlements/summary
func (h *SellerBalanceHandler) MemberSettlementSummary(c *gin.Context) {
	businessID := c.Param("business_id")
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid business id"})
		return
	}
	if _, ok := memberBusinessAccess(c, h.CatalogService, businessID); !ok {
		return
	}

	summary, err := h.SellerBalanceService.GetSettlementSummary(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// MemberListSettlements lists settlement history for the current member business.
// GET /member/businesses/:business_id/balance/settlements
func (h *SellerBalanceHandler) MemberListSettlements(c *gin.Context) {
	businessID := c.Param("business_id")
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid business id"})
		return
	}
	if _, ok := memberBusinessAccess(c, h.CatalogService, businessID); !ok {
		return
	}

	status := c.Query("status")
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

	settlements, total, err := h.SellerBalanceService.ListSettlements(c.Request.Context(), services.ListSettlementsInput{
		Status:   status,
		SellerID: businessID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  settlements,
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
