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

type PayoutHandler struct {
	svc *financesvc.FinanceService
}

func NewPayoutHandler(svc *financesvc.FinanceService) *PayoutHandler {
	return &PayoutHandler{svc: svc}
}

func (h *PayoutHandler) resolveBusinessID(c *gin.Context, fallback string) string {
	if businessID := strings.TrimSpace(c.Param("business_id")); businessID != "" {
		return businessID
	}
	return strings.TrimSpace(fallback)
}

func (h *PayoutHandler) ensureBusinessAccess(c *gin.Context, memberID, businessID string) bool {
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

type createBankAccountRequest struct {
	BusinessID    string `json:"business_id"`
	Bank          string `json:"bank"`
	AccountNumber string `json:"account_number"`
	OwnerName     string `json:"owner_name"`
	IsPrimary     *bool  `json:"is_primary"`
}

func (h *PayoutHandler) MemberList(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}
	businessID := strings.TrimSpace(c.Param("business_id"))
	var (
		items []financemodels.BankAccount
		err   error
	)
	if businessID != "" {
		if !h.ensureBusinessAccess(c, memberID, businessID) {
			return
		}
		items, err = h.svc.ListBankAccountsForBusiness(c.Request.Context(), businessID)
	} else {
		items, err = h.svc.ListBankAccountsForMember(c.Request.Context(), memberID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *PayoutHandler) MemberCreate(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}
	var req createBankAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	trimmedBusinessID := h.resolveBusinessID(c, req.BusinessID)
	if trimmedBusinessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}
	if !h.ensureBusinessAccess(c, memberID, trimmedBusinessID) {
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	account := &financemodels.BankAccount{
		ID:            id,
		BusinessID:    trimmedBusinessID,
		Bank:          strings.TrimSpace(req.Bank),
		AccountNumber: strings.TrimSpace(req.AccountNumber),
		OwnerName:     strings.TrimSpace(req.OwnerName),
	}
	if err := h.svc.CreateBankAccount(c.Request.Context(), account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req.IsPrimary != nil && *req.IsPrimary {
		if err := h.svc.SetPrimaryBankAccount(c.Request.Context(), trimmedBusinessID, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusCreated, gin.H{"data": account})
}

type updateBankAccountRequest struct {
	Bank          *string `json:"bank"`
	AccountNumber *string `json:"account_number"`
	OwnerName     *string `json:"owner_name"`
	IsPrimary     *bool   `json:"is_primary"`
}

func (h *PayoutHandler) MemberUpdate(c *gin.Context) {
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
	existing, err := h.svc.GetBankAccountByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank account not found"})
		return
	}
	if businessID != "" && strings.TrimSpace(existing.BusinessID) != businessID {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank account not found"})
		return
	}
	if !h.ensureBusinessAccess(c, memberID, existing.BusinessID) {
		return
	}
	var req updateBankAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Bank != nil {
		existing.Bank = strings.TrimSpace(*req.Bank)
	}
	if req.AccountNumber != nil {
		existing.AccountNumber = strings.TrimSpace(*req.AccountNumber)
	}
	if req.OwnerName != nil {
		existing.OwnerName = strings.TrimSpace(*req.OwnerName)
	}
	if err := h.svc.UpdateBankAccount(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req.IsPrimary != nil && *req.IsPrimary {
		if err := h.svc.SetPrimaryBankAccount(c.Request.Context(), existing.BusinessID, existing.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": existing})
}

func (h *PayoutHandler) MemberDelete(c *gin.Context) {
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
	existing, err := h.svc.GetBankAccountByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank account not found"})
		return
	}
	if businessID != "" && strings.TrimSpace(existing.BusinessID) != businessID {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank account not found"})
		return
	}
	if !h.ensureBusinessAccess(c, memberID, existing.BusinessID) {
		return
	}
	if _, err := h.svc.DeleteBankAccountByID(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
