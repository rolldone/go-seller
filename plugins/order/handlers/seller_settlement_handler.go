package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SellerSettlementHandler struct {
	Service *services.SellerBalanceService
}

func NewSellerSettlementHandler(svc *services.SellerBalanceService) *SellerSettlementHandler {
	return &SellerSettlementHandler{Service: svc}
}

// AdminListSettlements lists settlement requests for admin review.
// GET /admin/order/seller-balance/settlements
func (h *SellerSettlementHandler) AdminListSettlements(c *gin.Context) {
	status := c.Query("status")
	sellerID := strings.TrimSpace(c.Query("seller_id"))
	orderID := strings.TrimSpace(c.Query("order_id"))

	fromDate, err := parseSettlementDateQuery(c.Query("date_from"), false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date_from format"})
		return
	}
	toDate, err := parseSettlementDateQuery(c.Query("date_to"), true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date_to format"})
		return
	}

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

	settlements, total, err := h.Service.ListSettlements(c.Request.Context(), services.ListSettlementsInput{
		Status:   status,
		SellerID: sellerID,
		OrderID:  orderID,
		FromDate: fromDate,
		ToDate:   toDate,
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

func parseSettlementDateQuery(raw string, isEndOfDay bool) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		utc := parsed.UTC()
		return &utc, nil
	}
	if parsed, err := time.Parse("2006-01-02", trimmed); err == nil {
		if isEndOfDay {
			parsed = parsed.Add(24*time.Hour - time.Nanosecond)
		}
		utc := parsed.UTC()
		return &utc, nil
	}
	return nil, errors.New("invalid date format")
}

// AdminGetSettlement retrieves a single settlement for admin review.
// GET /admin/order/seller-balance/settlements/:id
func (h *SellerSettlementHandler) AdminGetSettlement(c *gin.Context) {
	settlementID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	settlement, err := h.Service.GetSettlementByID(c.Request.Context(), settlementID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "settlement not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settlement)
}

// AdminDecideSettlement decides whether to hold or release a pending settlement.
// POST /admin/order/seller-balance/settlements/:id/decision
func (h *SellerSettlementHandler) AdminDecideSettlement(c *gin.Context) {
	settlementID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	adminID := c.GetString("admin_id")
	var req struct {
		Decision      string          `json:"decision" binding:"required"`
		ReleaseAmount *int64          `json:"release_amount"`
		AdminNote     *string         `json:"admin_note"`
		Metadata      json.RawMessage `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settlement, mutation, err := h.Service.DecideSettlement(c.Request.Context(), settlementID, services.SettlementDecisionInput{
		Decision:      req.Decision,
		ReleaseAmount: req.ReleaseAmount,
		AdminID:       adminID,
		AdminNote:     req.AdminNote,
		Metadata:      req.Metadata,
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "settlement not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"settlement": settlement,
		"mutation":   mutation,
	})
}
