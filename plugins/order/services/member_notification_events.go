package services

import (
	"context"
	"fmt"
	"strings"

	"go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

type orderMemberNotificationPayloadBuilder func(context.Context, *models.Order, orderNotificationRecipient) map[string]any

func (s *OrderService) loadOrderForMemberNotification(ctx context.Context, orderID string) (*models.Order, error) {
	trimmedOrderID := strings.TrimSpace(orderID)
	if trimmedOrderID == "" {
		return nil, fmt.Errorf("order_id is required")
	}

	var order models.Order
	if err := s.DB.WithContext(ctx).
		Preload("Payments", func(db *gorm.DB) *gorm.DB { return db.Order("created_at DESC") }).
		Where("id = ?", trimmedOrderID).
		First(&order).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

func (s *OrderService) sendBusinessMemberNotifications(ctx context.Context, order *models.Order, eventKey string, buildPayload orderMemberNotificationPayloadBuilder) {
	if order == nil || order.BusinessID == nil || buildPayload == nil {
		return
	}
	businessID := strings.TrimSpace(*order.BusinessID)
	if businessID == "" {
		return
	}

	recipients, err := s.loadBusinessNotificationRecipients(ctx, businessID, eventKey)
	if err != nil || len(recipients) == 0 {
		owner, ownerErr := s.lookupBusinessNotificationOwner(ctx, businessID)
		if ownerErr == nil && strings.TrimSpace(owner.Email) != "" {
			recipients = []orderNotificationRecipient{owner}
		}
	}
	if len(recipients) == 0 {
		return
	}

	templateKey := eventKey + "_member"
	for _, recipient := range recipients {
		if strings.TrimSpace(recipient.Email) == "" {
			continue
		}
		payload := buildPayload(ctx, order, recipient)
		if len(payload) == 0 {
			continue
		}
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, templateKey, payload)
	}
}

func (s *OrderService) sendBusinessMemberNotificationsByOrderID(ctx context.Context, orderID string, eventKey string, buildPayload orderMemberNotificationPayloadBuilder) {
	order, err := s.loadOrderForMemberNotification(ctx, orderID)
	if err != nil {
		return
	}
	s.sendBusinessMemberNotifications(ctx, order, eventKey, buildPayload)
}

func (s *OrderService) buildOrderMemberNotificationPayload(ctx context.Context, order *models.Order, recipient orderNotificationRecipient) map[string]any {
	if order == nil {
		return map[string]any{}
	}

	businessID := ""
	if order.BusinessID != nil {
		businessID = strings.TrimSpace(*order.BusinessID)
	}
	paymentStatus := strings.TrimSpace(order.PaymentStatus)
	if len(order.Payments) > 0 {
		if latestStatus := strings.TrimSpace(order.Payments[0].Status); latestStatus != "" {
			paymentStatus = latestStatus
		}
	}
	if paymentStatus == "" {
		paymentStatus = "pending"
	}
	if strings.TrimSpace(order.Currency) == "" {
		order.Currency = "IDR"
	}

	sellerEmail := strings.TrimSpace(recipient.Email)
	sellerName := strings.TrimSpace(recipient.Name)
	if sellerName == "" {
		sellerName = sellerEmail
	}

	return map[string]any{
		"order_id":        order.ID,
		"order_number":    order.OrderNumber,
		"order_status":    strings.TrimSpace(order.Status),
		"payment_status":  paymentStatus,
		"grand_total":     fmt.Sprintf("%.2f", order.GrandTotal),
		"currency":        strings.TrimSpace(order.Currency),
		"seller_email":    sellerEmail,
		"seller_name":     sellerName,
		"business_name":   s.lookupBusinessName(ctx, businessID),
		"customer_locale": s.getDefaultNotificationLocale(ctx),
		"order_link":      "/member/orders",
	}
}

func (s *OrderService) sendOrderCreatedMemberNotificationsAsync(ctx context.Context, orderID string) {
	s.sendBusinessMemberNotificationsByOrderID(ctx, orderID, "order_created", s.buildOrderMemberNotificationPayload)
}

func (s *OrderService) sendPaymentSucceededMemberNotificationsAsync(ctx context.Context, orderID string) {
	s.sendBusinessMemberNotificationsByOrderID(ctx, orderID, "payment_succeeded", s.buildOrderMemberNotificationPayload)
}

func (s *OrderService) sendPaymentFailedMemberNotificationsAsync(ctx context.Context, orderID string) {
	s.sendBusinessMemberNotificationsByOrderID(ctx, orderID, "payment_failed", s.buildOrderMemberNotificationPayload)
}
