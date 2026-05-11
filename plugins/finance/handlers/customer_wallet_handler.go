package handlers

import (
	"net/http"
	"strconv"
	"strings"

	financesvc "go_framework/plugins/finance/services"

	"github.com/gin-gonic/gin"
)

type CustomerWalletHandler struct {
	svc *financesvc.FinanceService
}

func NewCustomerWalletHandler(svc *financesvc.FinanceService) *CustomerWalletHandler {
	return &CustomerWalletHandler{svc: svc}
}

func customerJWTCustomerID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString("customer_id"))
}

type customerWalletWithdrawalRequest struct {
	Amount            int64   `json:"amount"`
	BankName          string  `json:"bank_name"`
	BankAccountNumber string  `json:"bank_account_number"`
	BankAccountName   string  `json:"bank_account_name"`
	Notes             *string `json:"notes"`
}

func (h *CustomerWalletHandler) Summary(c *gin.Context) {
	customerID := customerJWTCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	summary, err := h.svc.GetCustomerWalletSummary(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}

func (h *CustomerWalletHandler) ListWithdrawals(c *gin.Context) {
	customerID := customerJWTCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	limit := 20
	if value := c.Query("limit"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	offset := 0
	page := 1
	if value := c.Query("page"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			page = parsed
			offset = (page - 1) * limit
		}
	}

	items, total, err := h.svc.ListCustomerWalletWithdrawals(c.Request.Context(), customerID, financesvc.CustomerWalletWithdrawalListInput{
		Status: c.Query("status"),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  items,
		"total": total,
		"limit": limit,
		"page":  page,
	})
}

func (h *CustomerWalletHandler) RequestWithdrawal(c *gin.Context) {
	customerID := customerJWTCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	var req customerWalletWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	withdrawal, err := h.svc.RequestCustomerWithdrawal(c.Request.Context(), customerID, financesvc.CustomerWalletWithdrawalInput{
		Amount:            req.Amount,
		BankName:          req.BankName,
		BankAccountNumber: req.BankAccountNumber,
		BankAccountName:   req.BankAccountName,
		Notes:             req.Notes,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": withdrawal})
}

func (h *CustomerWalletHandler) GetWithdrawal(c *gin.Context) {
	customerID := customerJWTCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	withdrawalID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	withdrawal, err := h.svc.GetCustomerWalletWithdrawalByID(c.Request.Context(), customerID, withdrawalID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "withdrawal not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": withdrawal})
}
