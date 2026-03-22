package services

import (
	"context"
	"errors"
	"time"

	"go_framework/plugins/order/models"
)

// Valid order statuses accepted by the callback endpoint.
var validOrderStatuses = map[string]bool{
	"pending":              true,
	"paid":                 true,
	"payment_verification": true,
	"confirmed":            true,
	"processing":           true,
	"shipped":              true,
	"completed":            true,
	"cancelled":            true,
	"refunded":             true,
	"failed":               true,
}

type CallbackPayload struct {
	OrderID       string         `json:"order_id"`
	Status        string         `json:"status"`
	PaymentStatus string         `json:"payment_status,omitempty"`
	Metadata      map[string]any `json:"metadata,omitempty"`
	Notes         string         `json:"notes,omitempty"`
}

// ProcessCallback validates and applies a status transition from an external system.
func (s *OrderService) ProcessCallback(ctx context.Context, payload CallbackPayload) (*models.Order, error) {
	if payload.OrderID == "" {
		return nil, errors.New("order_id is required")
	}
	if !validOrderStatuses[payload.Status] {
		return nil, errors.New("invalid status: " + payload.Status)
	}

	var order models.Order
	if err := s.DB.WithContext(ctx).Where("id = ?", payload.OrderID).First(&order).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	updates := map[string]any{
		"status":     payload.Status,
		"updated_at": now,
	}

	if payload.PaymentStatus != "" {
		updates["payment_status"] = payload.PaymentStatus
	}

	if payload.Status == "paid" {
		updates["payment_status"] = "paid"
		updates["paid_at"] = now
	}
	if payload.Status == "cancelled" {
		updates["cancelled_at"] = now
	}

	if payload.Notes != "" {
		updates["notes"] = payload.Notes
	}

	if err := s.DB.WithContext(ctx).Model(&order).Updates(updates).Error; err != nil {
		return nil, err
	}
	if payload.Status == "paid" || payload.PaymentStatus == "paid" {
		_ = RevokeGuestCheckoutTokenByOrderID(ctx, order.ID)
	}

	order.Status = payload.Status
	return &order, nil
}
