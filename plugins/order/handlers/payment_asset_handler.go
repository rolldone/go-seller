package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"go_framework/plugins/order/models"
	"go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type PaymentAssetHandler struct {
	svc *services.Services
}

func NewPaymentAssetHandler(s *services.Services) *PaymentAssetHandler {
	return &PaymentAssetHandler{svc: s}
}

// StreamProof streams the payment proof file from storage to the admin client.
// Admin JWT middleware must set "admin_id" in the context.
func (h *PaymentAssetHandler) StreamProof(c *gin.Context) {
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	if adminID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin authentication required"})
		return
	}

	paymentID := strings.TrimSpace(c.Param("payment_id"))
	proofID := strings.TrimSpace(c.Param("proof_id"))

	var proof models.PaymentProof
	if err := h.svc.Payment.DB.WithContext(c.Request.Context()).Where("id = ? AND payment_id = ? AND deleted_at IS NULL", proofID, paymentID).First(&proof).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "proof not found"})
		return
	}

	if h.svc.Payment.Store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage not configured"})
		return
	}

	if strings.TrimSpace(proof.StorageKey) == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no storage key for proof"})
		return
	}

	rc, err := h.svc.Payment.Store.Get(c.Request.Context(), proof.StorageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "failed to retrieve proof from storage"})
		return
	}
	defer rc.Close()

	if proof.MimeType != "" {
		c.Header("Content-Type", proof.MimeType)
	} else {
		c.Header("Content-Type", "application/octet-stream")
	}
	if proof.FileSize > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", proof.FileSize))
	}
	filename := proof.StorageKey
	if idx := strings.LastIndex(proof.StorageKey, "/"); idx >= 0 && idx+1 < len(proof.StorageKey) {
		filename = proof.StorageKey[idx+1:]
	}
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))

	if _, err := io.Copy(c.Writer, rc); err != nil {
		log.Printf("failed to stream proof %s: %v", proofID, err)
	}
}
