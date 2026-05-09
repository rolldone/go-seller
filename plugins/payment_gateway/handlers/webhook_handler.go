// Package handlers menyediakan webhook HTTP handler untuk setiap payment gateway adapter.
package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	ordermodels "go_framework/plugins/order/models"
	"go_framework/plugins/order/services"
	"go_framework/plugins/payment_gateway/pgwtypes"
)

// WebhookHandler menangani webhook dari payment gateway.
type WebhookHandler struct {
	paymentService *services.PaymentService
	registry       *pgwtypes.Registry
}

// NewWebhookHandler membuat instance baru WebhookHandler.
func NewWebhookHandler(paymentService *services.PaymentService, registry *pgwtypes.Registry) *WebhookHandler {
	return &WebhookHandler{
		paymentService: paymentService,
		registry:       registry,
	}
}

// RegisterWebhookRoutes mendaftarkan semua webhook route ke root router.
// Route: POST /webhooks/payment/:provider_key
func RegisterWebhookRoutes(paymentService *services.PaymentService, registry *pgwtypes.Registry, router *gin.Engine) {
	h := NewWebhookHandler(paymentService, registry)
	router.POST("/webhooks/payment/:provider_key", h.HandleWebhook)
}

// HandleWebhook menerima dan memproses webhook dari payment gateway.
// Alur:
//  1. Baca raw body
//  2. Cari adapter berdasarkan :provider_key
//  3. Ambil provider config dari DB (berdasarkan payment yang ditemukan dari gateway_transaction_id)
//  4. Panggil adapter.ParseWebhook untuk verifikasi signature dan parse event
//  5. Cari Payment internal berdasarkan GatewayTransactionID (= PaymentID kita saat CreatePayment)
//  6. Panggil PaymentService.RecheckGatewayPayment untuk update status dan catat history
func (h *WebhookHandler) HandleWebhook(c *gin.Context) {
	providerKey := strings.ToLower(strings.TrimSpace(c.Param("provider_key")))

	adapter, ok := h.registry.Get(providerKey)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown provider"})
		return
	}

	// Baca raw body (harus dibaca sebelum binding)
	rawBody, err := io.ReadAll(io.LimitReader(c.Request.Body, 2*1024*1024)) // max 2MB
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}
	if len(rawBody) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty request body"})
		return
	}

	// Kumpulkan headers yang relevan untuk signature verification
	headers := make(map[string]string)
	for key, vals := range c.Request.Header {
		if len(vals) > 0 {
			headers[strings.ToLower(key)] = vals[0]
		}
	}

	ctx := c.Request.Context()

	// Untuk mendapatkan provider config, kita perlu tahu payment ini milik provider mana.
	// Strategi: ParseWebhook pertama dengan config kosong untuk dapat GatewayTransactionID,
	// lalu fetch provider config, lalu ParseWebhook ulang dengan config lengkap.
	// Ini diperlukan karena kita butuh provider config untuk verifikasi signature.
	event, err := adapter.ParseWebhook(ctx, rawBody, headers, nil, nil)
	if err != nil {
		// Tetap return 200 untuk menghindari retry storm dari gateway
		c.JSON(http.StatusOK, gin.H{"status": "parse_error", "message": err.Error()})
		return
	}

	// Cari Payment berdasarkan identifier gateway yang dikenal.
	var payment *ordermodels.Payment
	for _, lookupKey := range event.LookupKeys() {
		payment, err = h.paymentService.GetPaymentByGatewayTransactionID(ctx, lookupKey)
		if err == nil && payment != nil {
			break
		}
	}
	if payment == nil {
		// Unknown payment — return 200 to prevent gateway retry storm
		c.JSON(http.StatusOK, gin.H{"status": "payment_not_found"})
		return
	}

	// Sekarang fetch provider dan parse webhook ulang dengan config lengkap untuk verifikasi signature
	if payment.ProviderID == nil || strings.TrimSpace(*payment.ProviderID) == "" {
		c.JSON(http.StatusOK, gin.H{"status": "provider_not_configured"})
		return
	}
	provider, err := h.paymentService.GetProviderByID(ctx, *payment.ProviderID)
	if err != nil || provider == nil {
		c.JSON(http.StatusOK, gin.H{"status": "provider_not_found"})
		return
	}

	// Re-parse dengan config lengkap untuk verifikasi signature yang akurat
	event, err = adapter.ParseWebhook(ctx, rawBody, headers, provider.Config, provider.CredentialsEncrypted)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "parse_error", "message": err.Error()})
		return
	}

	// Bangun input untuk RecheckGatewayPayment
	recheckIn := services.RecheckGatewayPaymentInput{
		ResolvedStatus:        &event.Status,
		ProviderTransactionID: event.ProviderTransactionID,
		ExternalReference:     event.ExternalReference,
		ProviderPayload:       event.RawPayload,
		EventIdempotencyKey:   event.IdempotencyKey,
	}

	if _, err := h.paymentService.RecheckGatewayPayment(ctx, payment.ID, nil, recheckIn); err != nil {
		// Log error tapi tetap return 200 agar gateway tidak retry
		c.JSON(http.StatusOK, gin.H{"status": "processing_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
