package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"go_framework/internal/storage"
	"go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"go_framework/internal/uuid"

	"gorm.io/gorm"
)

type PaymentService struct {
	DB    *gorm.DB
	Store storage.Store
}

func NewPaymentService(db *gorm.DB, store storage.Store) *PaymentService {
	return &PaymentService{DB: db, Store: store}
}

// PaymentStatus is the canonical set of payment status values used across the service.
type PaymentStatus string

const (
	StatusPending             PaymentStatus = "pending"
	StatusPendingVerification PaymentStatus = "pending_verification"
	StatusSucceeded           PaymentStatus = "succeeded"
	StatusFailed              PaymentStatus = "failed"
	StatusCancelled           PaymentStatus = "cancelled"
	StatusRejected            PaymentStatus = "rejected"
)

type PaymentProviderFilter struct {
	BusinessID      *string
	IncludeInactive bool
}

type UpsertPaymentProviderInput struct {
	BusinessID           *string
	Name                 string
	ProviderKey          string
	IsActive             bool
	IsUsed               bool
	Config               json.RawMessage
	CredentialsEncrypted *string
	UpdatedByAdminID     *string
}

type RecheckGatewayPaymentInput struct {
	ResolvedStatus        *string
	ProviderTransactionID *string
	ExternalReference     *string
	ProviderPayload       json.RawMessage
	EventIdempotencyKey   *string
	Notes                 *string
}

type PaymentReconciliationFilter struct {
	BusinessID  *string
	ProviderKey string
	Status      string
	From        *time.Time
	To          *time.Time
	Page        int
	Limit       int
}

type PaymentReconciliationItem struct {
	PaymentID             string     `json:"payment_id"`
	OrderID               string     `json:"order_id"`
	OrderNumber           string     `json:"order_number"`
	BusinessID            *string    `json:"business_id"`
	ProviderKey           *string    `json:"provider_key"`
	Status                string     `json:"status"`
	OrderPaymentStatus    string     `json:"order_payment_status"`
	Amount                float64    `json:"amount"`
	Currency              string     `json:"currency"`
	ProviderTransactionID *string    `json:"provider_transaction_id"`
	ExternalReference     *string    `json:"external_reference"`
	ReconciledAt          *time.Time `json:"reconciled_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	IsMismatch            bool       `json:"is_mismatch"`
}

type PaymentReconciliationSummary struct {
	Total         int64 `json:"total"`
	MismatchCount int64 `json:"mismatch_count"`
	PaidCount     int64 `json:"paid_count"`
	PendingCount  int64 `json:"pending_count"`
	FailedCount   int64 `json:"failed_count"`
}

type paymentReconciliationRow struct {
	PaymentID             string     `gorm:"column:payment_id"`
	OrderID               string     `gorm:"column:order_id"`
	OrderNumber           string     `gorm:"column:order_number"`
	BusinessID            *string    `gorm:"column:business_id"`
	ProviderKey           *string    `gorm:"column:provider_key"`
	Status                string     `gorm:"column:status"`
	OrderPaymentStatus    string     `gorm:"column:order_payment_status"`
	Amount                float64    `gorm:"column:amount"`
	Currency              string     `gorm:"column:currency"`
	ProviderTransactionID *string    `gorm:"column:provider_transaction_id"`
	ExternalReference     *string    `gorm:"column:external_reference"`
	ReconciledAt          *time.Time `gorm:"column:reconciled_at"`
	UpdatedAt             time.Time  `gorm:"column:updated_at"`
}

func normalizeProviderKey(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func (s *PaymentService) ListProviders(ctx context.Context, f PaymentProviderFilter) ([]models.PaymentProvider, error) {
	var items []models.PaymentProvider
	q := s.DB.WithContext(ctx).Model(&models.PaymentProvider{}).Where("deleted_at IS NULL")
	if f.BusinessID != nil && strings.TrimSpace(*f.BusinessID) != "" {
		// include both providers scoped to this business and global providers (business_id IS NULL)
		bid := strings.TrimSpace(*f.BusinessID)
		q = q.Where("(business_id = ? OR business_id IS NULL)", bid)
	}
	if !f.IncludeInactive {
		q = q.Where("is_active = ?", true)
	}
	if err := q.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *PaymentService) GetProviderByID(ctx context.Context, id string) (*models.PaymentProvider, error) {
	var p models.PaymentProvider
	if err := s.DB.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func providerScopeQuery(tx *gorm.DB, businessID *string) *gorm.DB {
	q := tx.Model(&models.PaymentProvider{}).Where("deleted_at IS NULL")
	if businessID == nil || strings.TrimSpace(*businessID) == "" {
		return q.Where("business_id IS NULL")
	}
	return q.Where("business_id = ?", strings.TrimSpace(*businessID))
}

func (s *PaymentService) CreateProvider(ctx context.Context, in UpsertPaymentProviderInput) (*models.PaymentProvider, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, errors.New("name is required")
	}
	providerKey := normalizeProviderKey(in.ProviderKey)
	if providerKey == "" {
		return nil, errors.New("provider_key is required")
	}

	item := &models.PaymentProvider{
		ID:                   uuid.NewString(),
		BusinessID:           in.BusinessID,
		Name:                 strings.TrimSpace(in.Name),
		ProviderKey:          providerKey,
		IsActive:             in.IsActive,
		IsUsed:               in.IsUsed,
		Config:               in.Config,
		CredentialsEncrypted: in.CredentialsEncrypted,
		CreatedByAdminID:     in.UpdatedByAdminID,
		UpdatedByAdminID:     in.UpdatedByAdminID,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}
	if len(item.Config) == 0 {
		item.Config = []byte("{}")
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if item.IsUsed {
			if err := tx.Model(&models.PaymentProvider{}).
				Where("deleted_at IS NULL").
				Update("is_used", false).Error; err != nil {
				return err
			}
		}
		return tx.Create(item).Error
	})
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (s *PaymentService) UpdateProvider(ctx context.Context, id string, in UpsertPaymentProviderInput) (*models.PaymentProvider, error) {
	var item models.PaymentProvider
	if err := s.DB.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&item).Error; err != nil {
		return nil, err
	}

	if strings.TrimSpace(in.Name) != "" {
		item.Name = strings.TrimSpace(in.Name)
	}
	if strings.TrimSpace(in.ProviderKey) != "" {
		item.ProviderKey = normalizeProviderKey(in.ProviderKey)
	}
	item.IsActive = in.IsActive
	item.IsUsed = in.IsUsed
	item.BusinessID = in.BusinessID
	if len(in.Config) > 0 {
		item.Config = in.Config
	}
	if in.CredentialsEncrypted != nil {
		item.CredentialsEncrypted = in.CredentialsEncrypted
	}
	item.UpdatedByAdminID = in.UpdatedByAdminID
	item.UpdatedAt = time.Now()

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if item.IsUsed {
			if err := tx.Model(&models.PaymentProvider{}).
				Where("deleted_at IS NULL AND id <> ?", item.ID).
				Update("is_used", false).Error; err != nil {
				return err
			}
		}
		return tx.Save(&item).Error
	})
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *PaymentService) ActivateProvider(ctx context.Context, id string, adminID *string) (*models.PaymentProvider, error) {
	var item models.PaymentProvider
	if err := s.DB.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&item).Error; err != nil {
		return nil, err
	}
	item.IsActive = true
	item.UpdatedAt = time.Now()
	item.UpdatedByAdminID = adminID
	if err := s.DB.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *PaymentService) CreatePayment(ctx context.Context, p *models.Payment) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	now := time.Now()
	if strings.TrimSpace(p.Status) == "" {
		p.Status = "pending"
	}
	if strings.TrimSpace(p.ProofStatus) == "" {
		p.ProofStatus = "none"
	}
	if len(p.Metadata) == 0 {
		p.Metadata = []byte("{}")
	}
	if p.NetAmount == 0 {
		p.NetAmount = p.Amount - p.FeeAmount
	}
	p.CreatedAt = now
	p.UpdatedAt = now
	return s.DB.WithContext(ctx).Create(p).Error
}

func (s *PaymentService) UpdatePaymentStatus(ctx context.Context, paymentID, status string, paidAt *time.Time) error {
	var revokeOrderID string
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var p models.Payment
		if err := tx.Where("id = ?", paymentID).First(&p).Error; err != nil {
			return err
		}
		p.Status = status
		if paidAt != nil {
			// Only set PaidAt if it's not already set
			if p.PaidAt == nil {
				p.PaidAt = paidAt
			}
		}
		if err := tx.Save(&p).Error; err != nil {
			return err
		}
		if status == "succeeded" {
			var order models.Order
			if err := tx.Where("id = ?", p.OrderID).First(&order).Error; err != nil {
				return err
			}
			if isOrderExpiredOrCancelled(order) {
				return errors.New("order expired")
			}
			orderUpdates := map[string]interface{}{"payment_status": "paid"}
			if paidAt != nil {
				orderUpdates["paid_at"] = paidAt
			}
			if err := tx.Model(&models.Order{}).Where("id = ?", p.OrderID).Updates(orderUpdates).Error; err != nil {
				return err
			}
			revokeOrderID = p.OrderID
		}
		return nil
	})
	if err != nil {
		return err
	}
	if strings.TrimSpace(revokeOrderID) != "" {
		_ = RevokeGuestCheckoutTokenByOrderID(ctx, revokeOrderID)
		pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "processing_order_customer", revokeOrderID)
	}
	return nil
}

func (s *PaymentService) UploadPaymentProof(ctx context.Context, paymentID string, adminID *string, fileHeader *multipart.FileHeader, notes *string) (*models.PaymentProof, error) {
	return s.uploadPaymentProof(ctx, paymentID, adminID, fileHeader, notes, "admin", adminID)
}

func (s *PaymentService) UploadPaymentProofAsGuest(ctx context.Context, paymentID string, customerID string, fileHeader *multipart.FileHeader, notes *string) (*models.PaymentProof, error) {
	trimmed := strings.TrimSpace(customerID)
	if trimmed == "" {
		return nil, errors.New("customer_id is required")
	}
	customerIDPtr := &trimmed
	return s.uploadPaymentProof(ctx, paymentID, nil, fileHeader, notes, "customer", customerIDPtr)
}

func (s *PaymentService) uploadPaymentProof(ctx context.Context, paymentID string, uploadedByAdminID *string, fileHeader *multipart.FileHeader, notes *string, actorType string, actorID *string) (*models.PaymentProof, error) {
	if s.Store == nil {
		return nil, errors.New("storage is not configured")
	}
	if fileHeader == nil {
		return nil, errors.New("proof file is required")
	}
	if fileHeader.Size <= 0 {
		return nil, errors.New("proof file is empty")
	}
	if fileHeader.Size > 5*1024*1024 {
		return nil, errors.New("proof file exceeds 5MB")
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowed[ext] {
		return nil, errors.New("proof file must be jpg, jpeg, png, or webp")
	}

	f, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer f.Close()

	body, err := io.ReadAll(io.LimitReader(f, 5*1024*1024+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read uploaded file: %w", err)
	}
	if int64(len(body)) > 5*1024*1024 {
		return nil, errors.New("proof file exceeds 5MB")
	}

	hash := sha256.Sum256(body)
	checksum := hex.EncodeToString(hash[:])
	storageKey := fmt.Sprintf("payments/proofs/%s/%s%s", paymentID, uuid.NewString(), ext)
	if err := s.Store.Put(ctx, storageKey, bytes.NewReader(body)); err != nil {
		return nil, fmt.Errorf("failed to upload proof to storage: %w", err)
	}

	// Do NOT persist a full public URL here; store only the storage key/path so
	// the application can generate a fresh signed or proxied URL later. This
	// avoids embedding domain-specific endpoints into the DB in case domains
	// or signing strategies change.
	// publicURL, _ := s.Store.PublicURL(ctx, storageKey)
	now := time.Now()
	proof := &models.PaymentProof{
		ID:         uuid.NewString(),
		PaymentID:  paymentID,
		StorageKey: storageKey,
		// Persist storage key; leave PublicURL nil so callers use the access
		// endpoint which will obtain a fresh URL from the storage implementation.
		PublicURL:         nil,
		MimeType:          fileHeader.Header.Get("Content-Type"),
		FileSize:          int64(len(body)),
		ChecksumSHA256:    &checksum,
		Notes:             notes,
		Status:            "uploaded",
		UploadedByAdminID: uploadedByAdminID,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payment models.Payment
		if err := tx.Where("id = ?", paymentID).First(&payment).Error; err != nil {
			return err
		}
		proof.OrderID = payment.OrderID

		if err := tx.Create(proof).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Payment{}).Where("id = ?", paymentID).Updates(map[string]any{
			"proof_status": "uploaded",
			"status":       "pending_verification",
			"updated_at":   now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Order{}).Where("id = ?", payment.OrderID).Updates(map[string]any{
			"payment_status": "payment_verification",
			"updated_at":     now,
		}).Error; err != nil {
			return err
		}

		eventStatus := "uploaded"
		history := &models.PaymentGatewayHistory{
			ID:          uuid.NewString(),
			PaymentID:   paymentID,
			ProviderKey: payment.ProviderKey,
			EventType:   "proof_uploaded",
			EventStatus: &eventStatus,
			ActorType:   strPtr(actorType),
			ActorID:     actorID,
			OccurredAt:  &now,
			ReceivedAt:  &now,
			CreatedAt:   now,
		}
		return tx.Create(history).Error
	})
	if err != nil {
		_ = s.Store.Delete(ctx, storageKey)
		return nil, err
	}
	pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "proof_uploaded_admin", proof.OrderID)

	return proof, nil
}

func (s *PaymentService) CancelPendingPaymentsByOrder(ctx context.Context, orderID string, actorType string, actorID *string, notes *string) error {
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return errors.New("order_id is required")
	}
	if strings.TrimSpace(actorType) == "" {
		actorType = "system"
	}

	now := time.Now()
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var items []models.Payment
		if err := tx.Where("order_id = ? AND status IN ?", orderID, []string{string(StatusPending), string(StatusPendingVerification)}).Find(&items).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}

		payload := map[string]any{"notes": notes}
		payloadJSON, _ := json.Marshal(payload)
		eventStatus := "cancelled"
		for i := range items {
			if err := tx.Model(&models.Payment{}).Where("id = ?", items[i].ID).Updates(map[string]any{
				"status":     string(StatusCancelled),
				"updated_at": now,
			}).Error; err != nil {
				return err
			}

			h := &models.PaymentGatewayHistory{
				ID:          uuid.NewString(),
				PaymentID:   items[i].ID,
				ProviderKey: items[i].ProviderKey,
				EventType:   "auto_cancelled",
				EventStatus: &eventStatus,
				Payload:     payloadJSON,
				ActorType:   strPtr(actorType),
				ActorID:     actorID,
				OccurredAt:  &now,
				ReceivedAt:  &now,
				CreatedAt:   now,
			}
			if err := tx.Create(h).Error; err != nil {
				return err
			}
		}

		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"payment_status": "unpaid",
			"updated_at":     now,
		}).Error
	})
}

func (s *PaymentService) ListPaymentProofs(ctx context.Context, paymentID string) ([]models.PaymentProof, error) {
	var proofs []models.PaymentProof
	if err := s.DB.WithContext(ctx).Where("payment_id = ? AND deleted_at IS NULL", paymentID).Order("created_at ASC").Find(&proofs).Error; err != nil {
		return nil, err
	}
	return proofs, nil
}

func (s *PaymentService) DeletePaymentProof(ctx context.Context, paymentID, proofID string, adminID *string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var proof models.PaymentProof
		if err := tx.Where("id = ? AND payment_id = ? AND deleted_at IS NULL", proofID, paymentID).First(&proof).Error; err != nil {
			return err
		}

		// attempt to delete object from storage if we have store
		if s.Store != nil && proof.StorageKey != "" {
			_ = s.Store.Delete(ctx, proof.StorageKey)
		}

		// soft-delete by setting deleted_at
		now := time.Now()
		if err := tx.Model(&models.PaymentProof{}).Where("id = ?", proofID).Updates(map[string]any{"deleted_at": &now, "updated_at": now}).Error; err != nil {
			return err
		}

		// if no more proofs exist for this payment, consider resetting payment proof_status
		var cnt int64
		if err := tx.Model(&models.PaymentProof{}).Where("payment_id = ? AND deleted_at IS NULL", paymentID).Count(&cnt).Error; err == nil {
			if cnt == 0 {
				// set payment.proof_status back to none and, if pending_verification, revert to pending
				if err := tx.Model(&models.Payment{}).Where("id = ?", paymentID).Updates(map[string]any{"proof_status": "none", "status": "pending", "updated_at": now}).Error; err != nil {
					return err
				}
			}
		}

		var payment models.Payment
		if err := tx.Where("id = ?", paymentID).First(&payment).Error; err != nil {
			return err
		}

		eventStatus := "deleted"
		h := &models.PaymentGatewayHistory{
			ID:          uuid.NewString(),
			PaymentID:   paymentID,
			ProviderKey: payment.ProviderKey,
			EventType:   "proof_deleted",
			EventStatus: &eventStatus,
			ActorType:   strPtr("admin"),
			ActorID:     adminID,
			OccurredAt:  &now,
			ReceivedAt:  &now,
			CreatedAt:   now,
		}
		if err := tx.Create(h).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *PaymentService) GetProofPublicURL(ctx context.Context, proofID string) (string, error) {
	var proof models.PaymentProof
	if err := s.DB.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", proofID).First(&proof).Error; err != nil {
		return "", err
	}
	if s.Store == nil {
		return "", errors.New("storage not configured")
	}
	if proof.StorageKey == "" {
		return "", errors.New("no storage key for proof")
	}
	return s.Store.PublicURL(ctx, proof.StorageKey)
}

func strPtr(v string) *string { return &v }

func strValue(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func (s *PaymentService) ReviewPaymentProof(ctx context.Context, paymentID, proofID, decision string, adminID *string, notes *string) error {
	decision = strings.ToLower(strings.TrimSpace(decision))
	if decision != "approve" && decision != "reject" {
		return errors.New("decision must be approve or reject")
	}
	now := time.Now()

	var revokeOrderID string
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payment models.Payment
		if err := tx.Where("id = ?", paymentID).First(&payment).Error; err != nil {
			return err
		}

		var proof models.PaymentProof
		if err := tx.Where("id = ? AND payment_id = ?", proofID, paymentID).First(&proof).Error; err != nil {
			return err
		}

		proof.ReviewedByAdminID = adminID
		proof.ReviewedAt = &now
		proof.UpdatedAt = now
		if notes != nil {
			proof.Notes = notes
		}

		if decision == "approve" {
			var order models.Order
			if err := tx.Where("id = ?", payment.OrderID).First(&order).Error; err != nil {
				return err
			}
			if isOrderExpiredOrCancelled(order) {
				return errors.New("order expired")
			}
			proof.Status = "approved"
			if err := tx.Save(&proof).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.Payment{}).Where("id = ?", paymentID).Updates(map[string]any{
				"proof_status": "approved",
				"status":       "succeeded",
				"paid_at":      now,
				"updated_at":   now,
			}).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.Order{}).Where("id = ?", payment.OrderID).Updates(map[string]any{
				"payment_status": "paid",
				"paid_at":        now,
				"updated_at":     now,
			}).Error; err != nil {
				return err
			}
			revokeOrderID = payment.OrderID
			eventStatus := "approved"
			h := &models.PaymentGatewayHistory{ID: uuid.NewString(), PaymentID: paymentID, ProviderKey: payment.ProviderKey, EventType: "manual_approved", EventStatus: &eventStatus, ActorType: strPtr("admin"), ActorID: adminID, OccurredAt: &now, ReceivedAt: &now, CreatedAt: now}
			return tx.Create(h).Error
		}

		proof.Status = "rejected"
		if err := tx.Save(&proof).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Payment{}).Where("id = ?", paymentID).Updates(map[string]any{
			"proof_status": "rejected",
			"status":       "rejected",
			"updated_at":   now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Order{}).Where("id = ?", payment.OrderID).Updates(map[string]any{
			"payment_status": "unpaid",
			"updated_at":     now,
		}).Error; err != nil {
			return err
		}
		eventStatus := "rejected"
		h := &models.PaymentGatewayHistory{ID: uuid.NewString(), PaymentID: paymentID, ProviderKey: payment.ProviderKey, EventType: "manual_rejected", EventStatus: &eventStatus, ActorType: strPtr("admin"), ActorID: adminID, OccurredAt: &now, ReceivedAt: &now, CreatedAt: now}
		return tx.Create(h).Error
	})
	if err != nil {
		return err
	}
	if strings.TrimSpace(revokeOrderID) != "" {
		_ = RevokeGuestCheckoutTokenByOrderID(ctx, revokeOrderID)
		pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "processing_order_customer", revokeOrderID)
	}
	return nil
}

func normalizePaymentStatus(status string) string {
	st := strings.ToLower(strings.TrimSpace(status))
	switch st {
	case "paid", "success", "succeeded", "settled":
		return string(StatusSucceeded)
	case "failed", "expire", "expired", "cancelled", "canceled", "rejected":
		return string(StatusFailed)
	case "pending", "awaiting_payment", "authorized":
		return string(StatusPending)
	default:
		// preserve known pending_verification as its own status
		if st == string(StatusPendingVerification) {
			return string(StatusPendingVerification)
		}
		return st
	}
}

func (s *PaymentService) RecheckGatewayPayment(ctx context.Context, paymentID string, adminID *string, in RecheckGatewayPaymentInput) (*models.Payment, error) {
	now := time.Now()
	returnPayment := &models.Payment{}
	var revokeOrderID string

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payment models.Payment
		if err := tx.Where("id = ?", paymentID).First(&payment).Error; err != nil {
			return err
		}
		providerKey := strings.ToLower(strings.TrimSpace(strValue(payment.ProviderKey)))
		if providerKey == "" || providerKey == "bank_transfer" || providerKey == "cash_money" {
			return errors.New("payment is not a gateway-type payment")
		}

		updates := map[string]any{"reconciled_at": now, "updated_at": now}
		finalStatus := payment.Status

		if in.ProviderTransactionID != nil && strings.TrimSpace(*in.ProviderTransactionID) != "" {
			updates["provider_transaction_id"] = strings.TrimSpace(*in.ProviderTransactionID)
			payment.ProviderTransactionID = in.ProviderTransactionID
		}
		if in.ExternalReference != nil && strings.TrimSpace(*in.ExternalReference) != "" {
			updates["external_reference"] = strings.TrimSpace(*in.ExternalReference)
			payment.ExternalReference = in.ExternalReference
		}
		if len(in.ProviderPayload) > 0 {
			updates["response_payload"] = in.ProviderPayload
		}

		if in.ResolvedStatus != nil && strings.TrimSpace(*in.ResolvedStatus) != "" {
			finalStatus = normalizePaymentStatus(*in.ResolvedStatus)
			updates["status"] = finalStatus
			if finalStatus == "succeeded" {
				updates["paid_at"] = now
			}
		}

		if err := tx.Model(&models.Payment{}).Where("id = ?", paymentID).Updates(updates).Error; err != nil {
			return err
		}

		orderUpdates := map[string]any{"updated_at": now}
		switch finalStatus {
		case "succeeded":
			var order models.Order
			if err := tx.Where("id = ?", payment.OrderID).First(&order).Error; err != nil {
				return err
			}
			if isOrderExpiredOrCancelled(order) {
				return errors.New("order expired")
			}
			orderUpdates["payment_status"] = "paid"
			orderUpdates["paid_at"] = now
			revokeOrderID = payment.OrderID
		case "pending":
			orderUpdates["payment_status"] = "unpaid"
		default:
			orderUpdates["payment_status"] = "unpaid"
		}
		if err := tx.Model(&models.Order{}).Where("id = ?", payment.OrderID).Updates(orderUpdates).Error; err != nil {
			return err
		}

		eventPayload := map[string]any{"notes": in.Notes, "resolved_status": finalStatus}
		eventPayloadJSON, _ := json.Marshal(eventPayload)
		eventStatus := finalStatus
		history := &models.PaymentGatewayHistory{
			ID:                  uuid.NewString(),
			PaymentID:           paymentID,
			ProviderKey:         payment.ProviderKey,
			EventType:           "gateway_status_checked",
			EventStatus:         &eventStatus,
			ProviderReference:   payment.ProviderTransactionID,
			Payload:             eventPayloadJSON,
			ActorType:           strPtr("admin"),
			ActorID:             adminID,
			EventIdempotencyKey: in.EventIdempotencyKey,
			OccurredAt:          &now,
			ReceivedAt:          &now,
			CreatedAt:           now,
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		if err := tx.Where("id = ?", paymentID).First(returnPayment).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(revokeOrderID) != "" {
		_ = RevokeGuestCheckoutTokenByOrderID(ctx, revokeOrderID)
		pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "processing_order_customer", revokeOrderID)
	} else if returnPayment.OrderID != "" {
		switch normalizePaymentStatus(returnPayment.Status) {
		case string(StatusFailed), string(StatusCancelled), string(StatusRejected):
			pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "failed_order_admin", returnPayment.OrderID)
		}
	}
	return returnPayment, nil
}

func (s *PaymentService) CancelPayment(ctx context.Context, paymentID string, adminID *string, notes *string) error {
	now := time.Now()
	var orderID string
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payment models.Payment
		if err := tx.Where("id = ?", paymentID).First(&payment).Error; err != nil {
			return err
		}
		orderID = payment.OrderID

		// only allow cancelling payments that are pending or pending_verification
		norm := normalizePaymentStatus(payment.Status)
		if norm != string(StatusPending) && norm != string(StatusPendingVerification) {
			return errors.New("only pending or pending_verification payments can be cancelled")
		}
		// allow cancelling even if proof exists for bank_transfer or cash_money
		providerKey := strings.ToLower(strings.TrimSpace(strValue(payment.ProviderKey)))
		if providerKey != "bank_transfer" && providerKey != "cash_money" {
			if payment.ProofStatus != "none" {
				return errors.New("payment with proof cannot be cancelled")
			}
		}
		if (payment.ProviderTransactionID != nil && strings.TrimSpace(*payment.ProviderTransactionID) != "") ||
			(payment.GatewayTransactionID != nil && strings.TrimSpace(*payment.GatewayTransactionID) != "") {
			return errors.New("payment with external transaction cannot be cancelled")
		}

		if err := tx.Model(&models.Payment{}).Where("id = ?", paymentID).Updates(map[string]any{"status": "cancelled", "updated_at": now}).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.Order{}).Where("id = ?", payment.OrderID).Updates(map[string]any{"status": "draft", "payment_status": "unpaid", "updated_at": now}).Error; err != nil {
			return err
		}

		payload := map[string]any{"notes": notes}
		payloadJSON, _ := json.Marshal(payload)
		eventStatus := "cancelled"
		h := &models.PaymentGatewayHistory{
			ID:          uuid.NewString(),
			PaymentID:   paymentID,
			ProviderKey: payment.ProviderKey,
			EventType:   "manual_cancelled",
			EventStatus: &eventStatus,
			Payload:     payloadJSON,
			ActorType:   strPtr("admin"),
			ActorID:     adminID,
			OccurredAt:  &now,
			ReceivedAt:  &now,
			CreatedAt:   now,
		}
		if err := tx.Create(h).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	if strings.TrimSpace(orderID) != "" {
		pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "cancelled_order_admin", orderID)
	}
	return nil
}

func (s *PaymentService) RejectPayment(ctx context.Context, paymentID string, adminID *string, notes *string) error {
	now := time.Now()
	var orderID string
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payment models.Payment
		if err := tx.Where("id = ?", paymentID).First(&payment).Error; err != nil {
			return err
		}
		orderID = payment.OrderID

		// only allow rejecting pending or pending_verification payments
		norm := normalizePaymentStatus(payment.Status)
		if norm != string(StatusPending) && norm != string(StatusPendingVerification) {
			return errors.New("only pending or pending_verification payments can be rejected")
		}

		// set payment to rejected; do not change order status (admin must handle next steps)
		if err := tx.Model(&models.Payment{}).Where("id = ?", paymentID).Updates(map[string]any{"status": "rejected", "updated_at": now}).Error; err != nil {
			return err
		}

		payload := map[string]any{"notes": notes}
		payloadJSON, _ := json.Marshal(payload)
		eventStatus := "rejected"
		h := &models.PaymentGatewayHistory{
			ID:          uuid.NewString(),
			PaymentID:   paymentID,
			ProviderKey: payment.ProviderKey,
			EventType:   "manual_rejected",
			EventStatus: &eventStatus,
			Payload:     payloadJSON,
			ActorType:   strPtr("admin"),
			ActorID:     adminID,
			OccurredAt:  &now,
			ReceivedAt:  &now,
			CreatedAt:   now,
		}
		if err := tx.Create(h).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	if strings.TrimSpace(orderID) != "" {
		pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "failed_order_admin", orderID)
	}
	return nil
}

func (s *PaymentService) GetReconciliationReport(ctx context.Context, f PaymentReconciliationFilter) ([]PaymentReconciliationItem, int64, PaymentReconciliationSummary, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Limit > 200 {
		f.Limit = 200
	}

	q := s.DB.WithContext(ctx).
		Table("payments p").
		Joins("JOIN orders o ON o.id = p.order_id").
		Where("p.provider_key IS NOT NULL").
		Where("p.provider_key NOT IN ?", []string{"bank_transfer", "cash_money"})

	if f.BusinessID != nil && strings.TrimSpace(*f.BusinessID) != "" {
		q = q.Where("o.business_id = ?", strings.TrimSpace(*f.BusinessID))
	}
	if strings.TrimSpace(f.ProviderKey) != "" {
		q = q.Where("p.provider_key = ?", strings.ToLower(strings.TrimSpace(f.ProviderKey)))
	}
	if strings.TrimSpace(f.Status) != "" {
		q = q.Where("p.status = ?", normalizePaymentStatus(f.Status))
	}
	if f.From != nil {
		q = q.Where("p.updated_at >= ?", *f.From)
	}
	if f.To != nil {
		q = q.Where("p.updated_at <= ?", *f.To)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, PaymentReconciliationSummary{}, err
	}

	selectColumns := []string{
		"p.id AS payment_id",
		"p.order_id AS order_id",
		"o.order_number AS order_number",
		"o.business_id AS business_id",
		"p.provider_key AS provider_key",
		"p.status AS status",
		"o.payment_status AS order_payment_status",
		"p.amount AS amount",
		"p.currency AS currency",
		"p.provider_transaction_id AS provider_transaction_id",
		"p.external_reference AS external_reference",
		"p.reconciled_at AS reconciled_at",
		"p.updated_at AS updated_at",
	}

	var rows []paymentReconciliationRow
	if err := q.Select(strings.Join(selectColumns, ", ")).
		Order("p.updated_at DESC").
		Limit(f.Limit).
		Offset((f.Page - 1) * f.Limit).
		Scan(&rows).Error; err != nil {
		return nil, 0, PaymentReconciliationSummary{}, err
	}

	items := make([]PaymentReconciliationItem, 0, len(rows))
	summary := PaymentReconciliationSummary{Total: total}
	for _, row := range rows {
		isMismatch := (row.Status == "succeeded" && row.OrderPaymentStatus != "paid") || (row.Status != "succeeded" && row.OrderPaymentStatus == "paid")
		if isMismatch {
			summary.MismatchCount++
		}
		switch row.Status {
		case "succeeded":
			summary.PaidCount++
		case "pending":
			summary.PendingCount++
		default:
			summary.FailedCount++
		}
		items = append(items, PaymentReconciliationItem{
			PaymentID:             row.PaymentID,
			OrderID:               row.OrderID,
			OrderNumber:           row.OrderNumber,
			BusinessID:            row.BusinessID,
			ProviderKey:           row.ProviderKey,
			Status:                row.Status,
			OrderPaymentStatus:    row.OrderPaymentStatus,
			Amount:                row.Amount,
			Currency:              row.Currency,
			ProviderTransactionID: row.ProviderTransactionID,
			ExternalReference:     row.ExternalReference,
			ReconciledAt:          row.ReconciledAt,
			UpdatedAt:             row.UpdatedAt,
			IsMismatch:            isMismatch,
		})
	}

	return items, total, summary, nil
}
