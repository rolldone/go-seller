package handlers

import (
	"net/http"
	"strconv"

	catalogservices "go_framework/plugins/catalog/services"
	"go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type SellerWithdrawalHandler struct {
	Service        *services.SellerWithdrawalService
	CatalogService *catalogservices.CatalogService
}

func NewSellerWithdrawalHandler(svc *services.SellerWithdrawalService, catalogService *catalogservices.CatalogService) *SellerWithdrawalHandler {
	return &SellerWithdrawalHandler{Service: svc, CatalogService: catalogService}
}

// RequestWithdrawal creates a new withdrawal request
// POST /member/businesses/:business_id/balance/withdrawals
func (h *SellerWithdrawalHandler) RequestWithdrawal(c *gin.Context) {
	sellerID := c.Param("business_id")
	if sellerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seller id"})
		return
	}
	if _, ok := memberBusinessAccess(c, h.CatalogService, sellerID); !ok {
		return
	}

	var req services.CreateWithdrawalInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	withdrawal, err := h.Service.RequestWithdrawal(c.Request.Context(), sellerID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, withdrawal)
}

// ListWithdrawals retrieves withdrawal history for a seller
// GET /member/businesses/:business_id/balance/withdrawals
func (h *SellerWithdrawalHandler) ListWithdrawals(c *gin.Context) {
	sellerID := c.Param("business_id")
	if sellerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seller id"})
		return
	}
	if _, ok := memberBusinessAccess(c, h.CatalogService, sellerID); !ok {
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

	withdrawals, total, err := h.Service.ListWithdrawals(c.Request.Context(), sellerID, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  withdrawals,
		"total": total,
		"limit": limit,
		"page":  (offset / limit) + 1,
	})
}

// GetWithdrawal retrieves a single withdrawal
// GET /member/businesses/:business_id/balance/withdrawals/:id
func (h *SellerWithdrawalHandler) GetWithdrawal(c *gin.Context) {
	sellerID := c.Param("business_id")
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if _, ok := memberBusinessAccess(c, h.CatalogService, sellerID); !ok {
		return
	}

	withdrawal, err := h.Service.GetWithdrawalByID(c.Request.Context(), id, sellerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, withdrawal)
}

// AdminListWithdrawals lists all withdrawals for admin
// GET /admin/order/withdrawals
func (h *SellerWithdrawalHandler) AdminListWithdrawals(c *gin.Context) {
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

	withdrawals, total, err := h.Service.AdminListWithdrawals(c.Request.Context(), status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  withdrawals,
		"total": total,
		"limit": limit,
		"page":  (offset / limit) + 1,
	})
}

// AdminApproveWithdrawal approves a pending withdrawal
// POST /admin/order/withdrawals/:id/approve
func (h *SellerWithdrawalHandler) AdminApproveWithdrawal(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	adminID := c.GetString("admin_id") // from JWT middleware

	var req struct {
		AdminNotes *string `json:"admin_notes"`
	}
	_ = c.ShouldBindJSON(&req)

	withdrawal, err := h.Service.ApproveWithdrawal(c.Request.Context(), id, adminID, req.AdminNotes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, withdrawal)
}

// AdminRejectWithdrawal rejects a withdrawal and refunds balance
// POST /admin/order/withdrawals/:id/reject
func (h *SellerWithdrawalHandler) AdminRejectWithdrawal(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	adminID := c.GetString("admin_id")

	var req struct {
		AdminNotes *string `json:"admin_notes"`
	}
	_ = c.ShouldBindJSON(&req)

	withdrawal, err := h.Service.RejectWithdrawal(c.Request.Context(), id, adminID, req.AdminNotes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, withdrawal)
}

// AdminMarkProcessed marks an approved withdrawal as processed
// POST /admin/order/withdrawals/:id/process
func (h *SellerWithdrawalHandler) AdminMarkProcessed(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	adminID := c.GetString("admin_id")

	var req struct {
		AdminNotes *string `json:"admin_notes"`
	}
	_ = c.ShouldBindJSON(&req)

	withdrawal, err := h.Service.MarkProcessed(c.Request.Context(), id, adminID, req.AdminNotes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, withdrawal)
}

// AdminGetWithdrawal retrieves a single withdrawal (admin view)
// GET /admin/order/withdrawals/:id
func (h *SellerWithdrawalHandler) AdminGetWithdrawal(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	withdrawal, err := h.Service.GetWithdrawalByID(c.Request.Context(), id, "")
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, withdrawal)
}

// AdminListWithdrawalAudits retrieves audit history for a withdrawal
// GET /admin/order/withdrawals/:id/audit
func (h *SellerWithdrawalHandler) AdminListWithdrawalAudits(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	audits, err := h.Service.ListWithdrawalAudits(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": audits})
}
