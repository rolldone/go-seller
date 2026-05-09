package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go_framework/internal/secrets"
	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PaymentHandler struct {
	svc *ordersvc.PaymentService
}

func NewPaymentHandler(svc *ordersvc.PaymentService) *PaymentHandler {
	return &PaymentHandler{svc: svc}
}

type createPaymentReq struct {
	OrderID       string   `json:"order_id" binding:"required"`
	Amount        float64  `json:"amount" binding:"required"`
	Currency      string   `json:"currency" binding:"required"`
	ProviderID    *string  `json:"provider_id"`
	ProviderKey   *string  `json:"provider_key"`
	PaymentMethod *string  `json:"payment_method"`
	GatewayName   *string  `json:"gateway_name"`
	FeeAmount     *float64 `json:"fee_amount"`
	Metadata      any      `json:"metadata"`
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
		ProviderID:    req.ProviderID,
		ProviderKey:   req.ProviderKey,
		PaymentMethod: req.PaymentMethod,
		GatewayName:   req.GatewayName,
		Status:        "pending",
		ProofStatus:   "none",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if req.FeeAmount != nil {
		p.FeeAmount = *req.FeeAmount
		p.NetAmount = req.Amount - *req.FeeAmount
	} else {
		p.NetAmount = req.Amount
	}
	if req.Metadata != nil {
		if b, err := json.Marshal(req.Metadata); err == nil {
			p.Metadata = b
		}
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

type createPaymentProviderReq struct {
	BusinessID           *string         `json:"business_id"`
	Name                 string          `json:"name" binding:"required"`
	ProviderKey          string          `json:"provider_key" binding:"required"`
	IsActive             bool            `json:"is_active"`
	Config               json.RawMessage `json:"config"`
	CredentialsEncrypted *string         `json:"credentials_encrypted"`
}

type replaceProviderSecretReq struct {
	CredentialsEncrypted string `json:"credentials_encrypted" binding:"required"`
}

func parsePaymentMethodConfig(raw []byte) map[string]any {
	cfg := map[string]any{}
	if len(raw) == 0 {
		return cfg
	}

	if err := json.Unmarshal(raw, &cfg); err == nil {
		return cfg
	}

	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return cfg
	}

	valueString, ok := value.(string)
	if !ok {
		return cfg
	}

	valueString = strings.TrimSpace(valueString)
	if valueString == "" {
		return cfg
	}

	if err := json.Unmarshal([]byte(valueString), &cfg); err == nil {
		return cfg
	}

	if decoded, err := base64.StdEncoding.DecodeString(valueString); err == nil {
		if err := json.Unmarshal(decoded, &cfg); err == nil {
			return cfg
		}
	}

	return cfg
}

func paymentMethodResponse(item ordermodels.PaymentMethod) gin.H {
	return gin.H{
		"id":          item.ID,
		"business_id": item.BusinessID,
		"provider_id": item.ProviderID,
		"name":        item.Name,
		"is_active":   item.IsActive,
		"sort_order":  item.SortOrder,
		"config":      parsePaymentMethodConfig(item.Config),
		"created_at":  item.CreatedAt,
		"updated_at":  item.UpdatedAt,
		"provider":    item.Provider,
	}
}

func (h *PaymentHandler) ListProviders(c *gin.Context) {
	businessID := strings.TrimSpace(c.Query("business_id"))
	includeInactive := strings.EqualFold(strings.TrimSpace(c.Query("include_inactive")), "true")
	var businessIDPtr *string
	if businessID != "" {
		businessIDPtr = &businessID
	}
	items, err := h.svc.ListProviders(c.Request.Context(), ordersvc.PaymentProviderFilter{BusinessID: businessIDPtr, IncludeInactive: includeInactive})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// deserialize config bytes into JSON objects so frontend receives usable config
	out := make([]gin.H, 0, len(items))
	for _, p := range items {
		var cfg interface{}
		if len(p.Config) > 0 {
			if err := json.Unmarshal(p.Config, &cfg); err != nil {
				cfg = map[string]interface{}{}
			}
		} else {
			cfg = map[string]interface{}{}
		}
		out = append(out, gin.H{
			"id":                    p.ID,
			"business_id":           p.BusinessID,
			"name":                  p.Name,
			"provider_key":          p.ProviderKey,
			"is_active":             p.IsActive,
			"config":                cfg,
			"credentials_encrypted": p.CredentialsEncrypted,
			"created_by_admin_id":   p.CreatedByAdminID,
			"updated_by_admin_id":   p.UpdatedByAdminID,
			"created_at":            p.CreatedAt,
			"updated_at":            p.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

func (h *PaymentHandler) GetProvider(c *gin.Context) {
	item, err := h.svc.GetProviderByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment provider not found"})
		return
	}
	cfg := map[string]interface{}{}
	if len(item.Config) > 0 {
		if err := json.Unmarshal(item.Config, &cfg); err != nil {
			cfg = map[string]interface{}{}
		}
	}
	credentialsStatus := "missing"
	credentialsMessage := ""
	if item.CredentialsEncrypted != nil && strings.TrimSpace(*item.CredentialsEncrypted) != "" {
		decrypted, decryptErr := secrets.DecryptBlob(*item.CredentialsEncrypted)
		if decryptErr != nil {
			credentialsStatus = "decrypt_failed"
			credentialsMessage = "Gagal decrypt kredensial. Isi ulang secret di Provider Config lalu simpan ulang."
		} else {
			var secretCfg map[string]interface{}
			if err := json.Unmarshal(decrypted, &secretCfg); err != nil {
				credentialsStatus = "invalid_json"
				credentialsMessage = "Kredensial berhasil didekripsi, tetapi format JSON tidak valid. Isi ulang secret lalu simpan ulang."
			} else {
				for key, value := range secretCfg {
					cfg[key] = value
				}
				credentialsStatus = "ok"
			}
		}
	}
	resp := gin.H{
		"id":                            item.ID,
		"business_id":                   item.BusinessID,
		"name":                          item.Name,
		"provider_key":                  item.ProviderKey,
		"is_active":                     item.IsActive,
		"config":                        cfg,
		"credentials_encrypted_status":  credentialsStatus,
		"credentials_encrypted_message": credentialsMessage,
		"credentials_encrypted":         item.CredentialsEncrypted,
		"created_by_admin_id":           item.CreatedByAdminID,
		"updated_by_admin_id":           item.UpdatedByAdminID,
		"created_at":                    item.CreatedAt,
		"updated_at":                    item.UpdatedAt,
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *PaymentHandler) CreateProvider(c *gin.Context) {
	var req createPaymentProviderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	item, err := h.svc.CreateProvider(c.Request.Context(), ordersvc.UpsertPaymentProviderInput{
		BusinessID:           req.BusinessID,
		Name:                 req.Name,
		ProviderKey:          req.ProviderKey,
		IsActive:             req.IsActive,
		Config:               req.Config,
		CredentialsEncrypted: req.CredentialsEncrypted,
		UpdatedByAdminID:     adminIDPtr,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h *PaymentHandler) UpdateProvider(c *gin.Context) {
	var req createPaymentProviderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	item, err := h.svc.UpdateProvider(c.Request.Context(), c.Param("id"), ordersvc.UpsertPaymentProviderInput{
		BusinessID:           req.BusinessID,
		Name:                 req.Name,
		ProviderKey:          req.ProviderKey,
		IsActive:             req.IsActive,
		Config:               req.Config,
		CredentialsEncrypted: req.CredentialsEncrypted,
		UpdatedByAdminID:     adminIDPtr,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *PaymentHandler) ReplaceProviderSecret(c *gin.Context) {
	var req replaceProviderSecretReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	secret := strings.TrimSpace(req.CredentialsEncrypted)
	if secret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "credentials_encrypted is required"})
		return
	}

	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}

	item, err := h.svc.ReplaceProviderCredentials(c.Request.Context(), c.Param("id"), &secret, adminIDPtr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *PaymentHandler) ActivateProvider(c *gin.Context) {
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	item, err := h.svc.ActivateProvider(c.Request.Context(), c.Param("id"), adminIDPtr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *PaymentHandler) UploadProof(c *gin.Context) {
	paymentID := strings.TrimSpace(c.Param("id"))
	fileHeader, err := c.FormFile("proof")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "proof file is required"})
		return
	}
	notes := strings.TrimSpace(c.PostForm("notes"))
	var notesPtr *string
	if notes != "" {
		notesPtr = &notes
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	proof, err := h.svc.UploadPaymentProof(c.Request.Context(), paymentID, adminIDPtr, fileHeader, notesPtr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": proof})
}

type reviewProofReq struct {
	Notes *string `json:"notes"`
}

type recheckPaymentReq struct {
	ResolvedStatus        *string         `json:"resolved_status"`
	ProviderTransactionID *string         `json:"provider_transaction_id"`
	ExternalReference     *string         `json:"external_reference"`
	ProviderPayload       json.RawMessage `json:"provider_payload"`
	EventIdempotencyKey   *string         `json:"event_idempotency_key"`
	Notes                 *string         `json:"notes"`
}

type cancelPaymentReq struct {
	Notes *string `json:"notes"`
}

func (h *PaymentHandler) ApproveProof(c *gin.Context) {
	h.reviewProof(c, "approve")
}

func (h *PaymentHandler) RejectProof(c *gin.Context) {
	h.reviewProof(c, "reject")
}

func (h *PaymentHandler) reviewProof(c *gin.Context, decision string) {
	paymentID := strings.TrimSpace(c.Param("id"))
	proofID := strings.TrimSpace(c.Param("proof_id"))
	var req reviewProofReq
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	if err := h.svc.ReviewPaymentProof(c.Request.Context(), paymentID, proofID, decision, adminIDPtr, req.Notes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *PaymentHandler) Recheck(c *gin.Context) {
	paymentID := strings.TrimSpace(c.Param("id"))
	var req recheckPaymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	payment, err := h.svc.RecheckGatewayPayment(c.Request.Context(), paymentID, adminIDPtr, ordersvc.RecheckGatewayPaymentInput{
		ResolvedStatus:        req.ResolvedStatus,
		ProviderTransactionID: req.ProviderTransactionID,
		ExternalReference:     req.ExternalReference,
		ProviderPayload:       req.ProviderPayload,
		EventIdempotencyKey:   req.EventIdempotencyKey,
		Notes:                 req.Notes,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": payment})
}

func (h *PaymentHandler) Cancel(c *gin.Context) {
	paymentID := strings.TrimSpace(c.Param("id"))
	var req cancelPaymentReq
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	if err := h.svc.CancelPayment(c.Request.Context(), paymentID, adminIDPtr, req.Notes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *PaymentHandler) Reject(c *gin.Context) {
	paymentID := strings.TrimSpace(c.Param("id"))
	var req cancelPaymentReq
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	if err := h.svc.RejectPayment(c.Request.Context(), paymentID, adminIDPtr, req.Notes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *PaymentHandler) ListProofs(c *gin.Context) {
	paymentID := strings.TrimSpace(c.Param("id"))
	proofs, err := h.svc.ListPaymentProofs(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": proofs})
}

func (h *PaymentHandler) LookupByID(c *gin.Context) {
	paymentID := strings.TrimSpace(c.Param("payment_id"))
	payment, err := h.svc.GetPaymentByID(c.Request.Context(), paymentID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": payment.ID, "order_id": payment.OrderID}})
}

func (h *PaymentHandler) DeleteProof(c *gin.Context) {
	paymentID := strings.TrimSpace(c.Param("id"))
	proofID := strings.TrimSpace(c.Param("proof_id"))
	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var adminIDPtr *string
	if adminID != "" {
		adminIDPtr = &adminID
	}
	if err := h.svc.DeletePaymentProof(c.Request.Context(), paymentID, proofID, adminIDPtr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *PaymentHandler) ProofAccess(c *gin.Context) {
	// Proxy-stream the proof binary so frontend can load images via the same
	// endpoint and we don't expose storage signed URLs.
	proofID := strings.TrimSpace(c.Param("proof_id"))
	var proof ordermodels.PaymentProof
	if err := h.svc.DB.WithContext(c.Request.Context()).Where("id = ? AND deleted_at IS NULL", proofID).First(&proof).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "proof not found"})
		return
	}

	if h.svc.Store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage not configured"})
		return
	}

	if strings.TrimSpace(proof.StorageKey) == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no storage key for proof"})
		return
	}

	rc, err := h.svc.Store.Get(c.Request.Context(), proof.StorageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "failed to retrieve proof from storage"})
		return
	}
	defer rc.Close()

	// set response headers
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
		// streaming error — log and return
		c.Error(err)
		return
	}
}

func (h *PaymentHandler) Report(c *gin.Context) {
	providerKey := strings.TrimSpace(c.Query("provider_key"))
	status := strings.TrimSpace(c.Query("status"))
	businessID := strings.TrimSpace(c.Query("business_id"))
	page := 1
	limit := 20
	if v := strings.TrimSpace(c.Query("page")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	parseTime := func(v string) *time.Time {
		if strings.TrimSpace(v) == "" {
			return nil
		}
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return nil
		}
		return &t
	}
	from := parseTime(strings.TrimSpace(c.Query("from")))
	to := parseTime(strings.TrimSpace(c.Query("to")))

	var businessIDPtr *string
	if businessID != "" {
		businessIDPtr = &businessID
	}

	items, total, summary, err := h.svc.GetReconciliationReport(c.Request.Context(), ordersvc.PaymentReconciliationFilter{
		BusinessID:  businessIDPtr,
		ProviderKey: providerKey,
		Status:      status,
		From:        from,
		To:          to,
		Page:        page,
		Limit:       limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total, "summary": summary})
}

// ─── PaymentMethod handlers ───────────────────────────────────────────────────

func (h *PaymentHandler) ListMethods(c *gin.Context) {
	includeInactive := strings.EqualFold(c.Query("include_inactive"), "true")
	var providerIDPtr, businessIDPtr *string
	if v := strings.TrimSpace(c.Query("provider_id")); v != "" {
		providerIDPtr = &v
	}
	if v := strings.TrimSpace(c.Query("business_id")); v != "" {
		businessIDPtr = &v
	}
	items, err := h.svc.ListPaymentMethods(c.Request.Context(), ordersvc.PaymentMethodFilter{
		BusinessID:      businessIDPtr,
		ProviderID:      providerIDPtr,
		IncludeInactive: includeInactive,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(items))
	for _, item := range items {
		out = append(out, paymentMethodResponse(item))
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

func (h *PaymentHandler) GetMethod(c *gin.Context) {
	item, err := h.svc.GetPaymentMethodByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment method not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": paymentMethodResponse(*item)})
}

type upsertPaymentMethodReq struct {
	BusinessID *string         `json:"business_id"`
	ProviderID string          `json:"provider_id" binding:"required"`
	Name       string          `json:"name" binding:"required"`
	IsActive   bool            `json:"is_active"`
	SortOrder  int             `json:"sort_order"`
	Config     json.RawMessage `json:"config"`
}

func (h *PaymentHandler) CreateMethod(c *gin.Context) {
	var req upsertPaymentMethodReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.CreatePaymentMethod(c.Request.Context(), ordersvc.UpsertPaymentMethodInput{
		BusinessID: req.BusinessID,
		ProviderID: req.ProviderID,
		Name:       req.Name,
		IsActive:   req.IsActive,
		SortOrder:  req.SortOrder,
		Config:     req.Config,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": paymentMethodResponse(*item)})
}

func (h *PaymentHandler) UpdateMethod(c *gin.Context) {
	var req upsertPaymentMethodReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.UpdatePaymentMethod(c.Request.Context(), c.Param("id"), ordersvc.UpsertPaymentMethodInput{
		BusinessID: req.BusinessID,
		ProviderID: req.ProviderID,
		Name:       req.Name,
		IsActive:   req.IsActive,
		SortOrder:  req.SortOrder,
		Config:     req.Config,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": paymentMethodResponse(*item)})
}

func (h *PaymentHandler) DeleteMethod(c *gin.Context) {
	if err := h.svc.DeletePaymentMethod(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
