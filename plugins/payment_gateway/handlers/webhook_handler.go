package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"go_framework/plugins/payment_gateway/models"
	"go_framework/plugins/payment_gateway/pgwtypes"
	"go_framework/plugins/payment_gateway/services"

	"github.com/gin-gonic/gin"
)

type WebhookHandler struct {
	getGateway func(key string) (pgwtypes.PaymentGateway, bool)
	logSvc     *services.LogService
}

func NewWebhookHandler(getGateway func(key string) (pgwtypes.PaymentGateway, bool), logSvc *services.LogService) *WebhookHandler {
	return &WebhookHandler{getGateway: getGateway, logSvc: logSvc}
}

// Handle dispatches an incoming webhook/callback from a payment gateway provider
// to the registered gateway implementation.
//
// Route: POST /api/payment-gateway/webhook/:provider_key
//
// The endpoint is intentionally NOT protected by admin JWT because it is called
// by the external payment gateway, not by the admin. Each gateway implementation
// is responsible for validating the request signature inside HandleCallback.
func (h *WebhookHandler) Handle(c *gin.Context) {
	providerKey := c.Param("provider_key")
	if providerKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider_key is required"})
		return
	}

	// Buffer raw body for logging before it is consumed by the gateway.
	var rawBody []byte
	if c.Request.Body != nil {
		rawBody, _ = io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytesReader(rawBody))
	}

	gateway, ok := h.getGateway(providerKey)
	if !ok {
		h.saveLog(c, providerKey, rawBody, nil, "", "", "gateway not registered")
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("payment gateway '%s' not registered", providerKey)})
		return
	}

	result, err := gateway.HandleCallback(c)

	var errMsg string
	if err != nil {
		errMsg = err.Error()
	}
	respBytes, _ := json.Marshal(result)
	h.saveLog(c, providerKey, rawBody, respBytes, result.OrderID, result.ProviderTransactionID, errMsg)

	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}

	// Return 200 to acknowledge receipt to the payment gateway provider.
	c.JSON(http.StatusOK, gin.H{"received": true, "order_id": result.OrderID, "status": result.Status})
}

func (h *WebhookHandler) saveLog(c *gin.Context, providerKey string, reqBody, respBody []byte, referenceID, providerTxID, errMsg string) {
	if h.logSvc == nil {
		return
	}
	entry := services.LogEntry{
		ProviderKey:     providerKey,
		Direction:       models.LogDirectionInbound,
		EventType:       models.LogEventWebhook,
		RequestPayload:  reqBody,
		ResponsePayload: respBody,
	}
	if referenceID != "" {
		entry.ReferenceID = &referenceID
	}
	if providerTxID != "" {
		entry.ProviderTransactionID = &providerTxID
	}
	if errMsg != "" {
		entry.ErrorMessage = &errMsg
	}
	ip := c.ClientIP()
	if ip != "" {
		entry.IPAddress = &ip
	}
	_ = h.logSvc.Save(c.Request.Context(), entry)
}

// bytesReader wraps a byte slice to satisfy io.ReadCloser.
type bytesReader []byte

func (b bytesReader) Read(p []byte) (n int, err error) {
	return copy(p, b), io.EOF
}
