package handlers

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"

	"go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

// CallbackHandler handles encrypted server-to-server order status callbacks.
type CallbackHandler struct {
	orderSvc *services.OrderService
}

func NewCallbackHandler(orderSvc *services.OrderService) *CallbackHandler {
	return &CallbackHandler{orderSvc: orderSvc}
}

type encryptedCallbackRequest struct {
	Nonce string `json:"nonce" binding:"required"`
	Data  string `json:"data" binding:"required"`
}

type callbackEnvelope struct {
	TS      int64                    `json:"ts"`
	Payload services.CallbackPayload `json:"payload"`
}

const callbackTimestampSkewSeconds = 60

// HandleCallback POST /api/order/callback
// Expects AES-256-GCM encrypted payload: { nonce: base64, data: base64(ciphertext) }.
func (h *CallbackHandler) HandleCallback(c *gin.Context) {
	var req encryptedCallbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plaintext, err := decryptS2SPayload(req.Nonce, req.Data)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid encrypted payload"})
		return
	}

	var envelope callbackEnvelope
	if err := json.Unmarshal(plaintext, &envelope); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid decrypted payload"})
		return
	}

	if envelope.TS == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ts is required"})
		return
	}
	now := time.Now().Unix()
	if envelope.TS < now-callbackTimestampSkewSeconds || envelope.TS > now+callbackTimestampSkewSeconds {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "expired callback payload"})
		return
	}

	order, err := h.orderSvc.ProcessCallback(c.Request.Context(), envelope.Payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"data": gin.H{
			"id":             order.ID,
			"order_number":   order.OrderNumber,
			"status":         order.Status,
			"payment_status": order.PaymentStatus,
			"updated_at":     order.UpdatedAt,
		},
	})
}

func decryptS2SPayload(nonceB64, dataB64 string) ([]byte, error) {
	keyB64 := os.Getenv("S2S_KEY")
	if keyB64 == "" {
		return nil, errors.New("S2S_KEY is not set")
	}

	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, errors.New("S2S_KEY must decode to exactly 32 bytes")
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceB64)
	if err != nil {
		return nil, err
	}

	ciphertext, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(nonce) != gcm.NonceSize() {
		return nil, errors.New("invalid nonce size")
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}
