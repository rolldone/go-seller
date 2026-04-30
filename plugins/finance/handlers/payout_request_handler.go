package handlers

import (
	"errors"
	"net/http"
	"strings"

	"go_framework/internal/uuid"
	catalogservices "go_framework/plugins/catalog/services"
	financemodels "go_framework/plugins/finance/models"
	financesvc "go_framework/plugins/finance/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PayoutRequestHandler struct {
	svc *financesvc.FinanceService
}

func NewPayoutRequestHandler(svc *financesvc.FinanceService) *PayoutRequestHandler {
	return &PayoutRequestHandler{svc: svc}
}

type createPayoutRequest struct {
	BusinessID    string  `json:"business_id"`
	BankAccountID string  `json:"bank_account_id"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
}

func (h *PayoutRequestHandler) resolveBusinessID(c *gin.Context, fallback string) string {
	if businessID := strings.TrimSpace(c.Param("business_id")); businessID != "" {
		return businessID
	}
	return strings.TrimSpace(fallback)
}

func (h *PayoutRequestHandler) ensureBusinessAccess(c *gin.Context, memberID, businessID string) bool {
	catalogSvc := catalogservices.New(h.svc.DB, h.svc.Store)
	if _, err := catalogSvc.GetBusinessByIDForMember(c.Request.Context(), memberID, strings.TrimSpace(businessID)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	return true
}

func (h *PayoutRequestHandler) MemberCreate(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}
	var req createPayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	businessID := h.resolveBusinessID(c, req.BusinessID)
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}
	if req.BankAccountID == "" || req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bank_account_id and positive amount required"})
		return
	}
	// fetch bank account
	account, err := h.svc.GetBankAccountByID(c.Request.Context(), strings.TrimSpace(req.BankAccountID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank account not found"})
		return
	}
	if account.BusinessID != businessID {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank account not found"})
		return
	}
	if !h.ensureBusinessAccess(c, memberID, businessID) {
		return
	}
	if !account.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bank account not verified"})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	payout := &financemodels.Payout{
		ID:            id,
		MemberID:      memberID,
		BusinessID:    businessID,
		BankAccountID: &account.ID,
		Amount:        req.Amount,
		Currency:      strings.TrimSpace(req.Currency),
		Status:        "pending",
	}
	if payout.Currency == "" {
		payout.Currency = "IDR"
	}
	if err := h.svc.CreatePayoutRequest(c.Request.Context(), payout); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": payout})
}

func (h *PayoutRequestHandler) MemberList(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}
	businessID := strings.TrimSpace(c.Param("business_id"))
	var (
		items []financemodels.Payout
		err   error
	)
	if businessID != "" {
		if !h.ensureBusinessAccess(c, memberID, businessID) {
			return
		}
		items, err = h.svc.ListPayoutsForMemberAndBusiness(c.Request.Context(), memberID, businessID)
	} else {
		items, err = h.svc.ListPayoutsForMember(c.Request.Context(), memberID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *PayoutRequestHandler) MemberGetByID(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}
	businessID := strings.TrimSpace(c.Param("business_id"))
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}
	item, err := h.svc.GetPayoutByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payout not found"})
		return
	}
	if item.MemberID != memberID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}
	if businessID != "" && strings.TrimSpace(item.BusinessID) != businessID {
		c.JSON(http.StatusNotFound, gin.H{"error": "payout not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}
