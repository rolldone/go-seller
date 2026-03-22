package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"go_framework/internal/uuid"
	"go_framework/plugins/order/models"
)

type GuestCheckoutAuditEntry struct {
	ID         string         `json:"id"`
	EventType  string         `json:"event_type"`
	Token      string         `json:"token,omitempty"`
	CustomerID string         `json:"customer_id,omitempty"`
	PaymentID  string         `json:"payment_id,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

func (s *OrderService) AppendGuestCheckoutAudit(ctx context.Context, orderID string, entry GuestCheckoutAuditEntry) error {
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil
	}
	if strings.TrimSpace(entry.EventType) == "" {
		return nil
	}
	if strings.TrimSpace(entry.ID) == "" {
		entry.ID = uuid.NewString()
	}
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = time.Now().UTC()
	}

	var order models.Order
	if err := s.DB.WithContext(ctx).Select("id", "metadata").Where("id = ?", orderID).First(&order).Error; err != nil {
		return err
	}

	root := map[string]any{}
	if len(order.Metadata) > 0 {
		_ = json.Unmarshal(order.Metadata, &root)
	}
	if root == nil {
		root = map[string]any{}
	}

	auditList := make([]any, 0)
	if current, ok := root["guest_checkout_audit"]; ok {
		if arr, arrOK := current.([]any); arrOK {
			auditList = append(auditList, arr...)
		}
	}
	auditList = append(auditList, entry)
	if len(auditList) > 100 {
		auditList = auditList[len(auditList)-100:]
	}
	root["guest_checkout_audit"] = auditList

	metadataBytes, err := json.Marshal(root)
	if err != nil {
		return err
	}
	return s.DB.WithContext(ctx).Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{"metadata": metadataBytes, "updated_at": time.Now()}).Error
}
