package handlers

import (
	"net/http"
	"time"

	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type PaymentHandler struct {
	svc *ordersvc.PaymentService
}

func NewPaymentHandler(svc *ordersvc.PaymentService) *PaymentHandler {
	return &PaymentHandler{svc: svc}
}

type createPaymentReq struct {
	OrderID       string  `json:"order_id" binding:"required"`
	Amount        float64 `json:"amount" binding:"required"`
	Currency      string  `json:"currency" binding:"required"`
	PaymentMethod *string `json:"payment_method"`
	GatewayName   *string `json:"gateway_name"`
}

func (h *PaymentHandler) Create(c *gin.Context) {
	var req createPaymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p := &ordermodels.Payment{
		OrderID:       req.OrderID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		PaymentMethod: req.PaymentMethod,
		GatewayName:   req.GatewayName,
		Status:        "pending",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if err := h.svc.CreatePayment(c.Request.Context(), p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": p})
}

type updateStatusReq struct {
	Status string     `json:"status" binding:"required"`
	PaidAt *time.Time `json:"paid_at"`
}

func (h *PaymentHandler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var req updateStatusReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.UpdatePaymentStatus(c.Request.Context(), id, req.Status, req.PaidAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
