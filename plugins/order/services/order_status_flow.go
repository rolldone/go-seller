package services

import (
	"strings"
	"time"

	"go_framework/plugins/order/models"

	"gorm.io/gorm"
)

type orderShipmentSyncResult struct {
	PreviousOrderStatus    string
	CurrentOrderStatus     string
	PreviousDeliveryStatus string
	CurrentDeliveryStatus  string
	OrderStatusChanged     bool
	DeliveryStatusChanged  bool
}

type orderShipmentProgress struct {
	ShippableItemCount      int64
	AssignedItemCount       int64
	ActiveShipmentCount     int64
	ShippedOrDeliveredCount int64 // shipped | in_transit | delivered
	DeliveredCount          int64
	ExceptionCount          int64 // exception status
	ReturnedCount           int64 // returned status
	InTransitCount          int64 // shipped | in_transit (with carrier)
}

func normalizeOrderStatus(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "confirmed" {
		return OrderStatusProcessing
	}
	return normalized
}

func isOrderStatusManagedByShipment(status string) bool {
	switch normalizeOrderStatus(status) {
	case "", "draft", "pending", "unpaid", "paid", "confirmed",
		OrderStatusProcessing, OrderStatusShipped:
		return true
	default:
		return false
	}
}

func nextPaidOrderStatus(currentStatus string) string {
	switch normalizeOrderStatus(currentStatus) {
	case "", "draft", "pending", "unpaid", "paid", "confirmed", "pending_verification", "payment_verification":
		return OrderStatusProcessing
	default:
		return normalizeOrderStatus(currentStatus)
	}
}

func (p orderShipmentProgress) allShippableItemsAssigned() bool {
	if p.ShippableItemCount == 0 {
		return true
	}
	return p.AssignedItemCount >= p.ShippableItemCount
}

func (p orderShipmentProgress) allActiveShipmentsShippedOrDelivered() bool {
	return p.ActiveShipmentCount > 0 && p.ShippedOrDeliveredCount == p.ActiveShipmentCount
}

func (p orderShipmentProgress) allActiveShipmentsDelivered() bool {
	return p.ActiveShipmentCount > 0 && p.DeliveredCount == p.ActiveShipmentCount
}

func nextOrderStatusFromShipmentProgress(currentStatus string, paymentStatus string, fulfillmentType string, progress orderShipmentProgress) string {
	normalizedCurrent := normalizeOrderStatus(currentStatus)
	if !strings.EqualFold(strings.TrimSpace(paymentStatus), PaymentStatusPaid) {
		return normalizedCurrent
	}
	if strings.EqualFold(strings.TrimSpace(fulfillmentType), FulfillmentTypePickup) {
		return normalizedCurrent
	}
	if !isOrderStatusManagedByShipment(normalizedCurrent) {
		return normalizedCurrent
	}
	if progress.ActiveShipmentCount == 0 {
		return OrderStatusProcessing
	}
	// All active shipments delivered → ready for customer confirmation
	if progress.allActiveShipmentsDelivered() {
		return OrderStatusWaitingCustomerConfirmation
	}
	// All assigned and at least shipped/in_transit
	if progress.allShippableItemsAssigned() && progress.allActiveShipmentsShippedOrDelivered() {
		return OrderStatusShipped
	}
	return OrderStatusProcessing
}

func canRequestCustomerConfirmation(fulfillmentType string, progress orderShipmentProgress) bool {
	if strings.EqualFold(strings.TrimSpace(fulfillmentType), FulfillmentTypePickup) {
		return true
	}
	if progress.ShippableItemCount == 0 {
		return true
	}
	if !progress.allShippableItemsAssigned() {
		return false
	}
	return progress.allActiveShipmentsDelivered()
}

func loadOrderShipmentProgressTx(tx *gorm.DB, orderID string) (orderShipmentProgress, error) {
	progress := orderShipmentProgress{}
	if tx == nil || strings.TrimSpace(orderID) == "" {
		return progress, nil
	}

	if err := tx.Model(&models.OrderItem{}).
		Where("order_id = ? AND (product_type = '' OR LOWER(product_type) != ?)", orderID, "digital").
		Count(&progress.ShippableItemCount).Error; err != nil {
		return progress, err
	}

	cancelledStatuses := []string{"cancelled", "canceled"}

	if err := tx.Model(&models.OrderShipment{}).
		Where("order_id = ? AND LOWER(status) NOT IN ?", orderID, cancelledStatuses).
		Count(&progress.ActiveShipmentCount).Error; err != nil {
		return progress, err
	}

	if err := tx.Table("order_shipment_items osi").
		Joins("JOIN order_shipments os ON os.id = osi.shipment_id").
		Joins("JOIN order_items oi ON oi.id = osi.order_item_id").
		Where("os.order_id = ? AND oi.order_id = ? AND (oi.product_type = '' OR LOWER(oi.product_type) != ?) AND LOWER(os.status) NOT IN ?", orderID, orderID, "digital", cancelledStatuses).
		Distinct("oi.id").
		Count(&progress.AssignedItemCount).Error; err != nil {
		return progress, err
	}

	if err := tx.Model(&models.OrderShipment{}).
		Where("order_id = ? AND LOWER(status) IN ?", orderID, []string{ShipmentStatusShipped, ShipmentStatusInTransit, ShipmentStatusDelivered}).
		Count(&progress.ShippedOrDeliveredCount).Error; err != nil {
		return progress, err
	}

	if err := tx.Model(&models.OrderShipment{}).
		Where("order_id = ? AND LOWER(status) = ?", orderID, ShipmentStatusDelivered).
		Count(&progress.DeliveredCount).Error; err != nil {
		return progress, err
	}

	if err := tx.Model(&models.OrderShipment{}).
		Where("order_id = ? AND LOWER(status) = ?", orderID, ShipmentStatusException).
		Count(&progress.ExceptionCount).Error; err != nil {
		return progress, err
	}

	if err := tx.Model(&models.OrderShipment{}).
		Where("order_id = ? AND LOWER(status) = ?", orderID, ShipmentStatusReturned).
		Count(&progress.ReturnedCount).Error; err != nil {
		return progress, err
	}

	if err := tx.Model(&models.OrderShipment{}).
		Where("order_id = ? AND LOWER(status) IN ?", orderID, []string{ShipmentStatusShipped, ShipmentStatusInTransit}).
		Count(&progress.InTransitCount).Error; err != nil {
		return progress, err
	}

	return progress, nil
}

// nextDeliveryStatusFromProgress computes the aggregate delivery_status for an order.
func nextDeliveryStatusFromProgress(fulfillmentType string, progress orderShipmentProgress) string {
	if strings.EqualFold(strings.TrimSpace(fulfillmentType), FulfillmentTypePickup) {
		return DeliveryStatusNotApplicable
	}
	if progress.ShippableItemCount == 0 {
		return DeliveryStatusNotApplicable
	}
	if progress.ActiveShipmentCount == 0 {
		return DeliveryStatusPending
	}
	// problem states take priority
	if progress.ExceptionCount > 0 {
		return DeliveryStatusException
	}
	if progress.ReturnedCount > 0 {
		return DeliveryStatusReturned
	}
	// all active delivered?
	if progress.DeliveredCount >= progress.ActiveShipmentCount {
		return DeliveryStatusDelivered
	}
	// all shipped or in-transit?
	if progress.InTransitCount+progress.DeliveredCount >= progress.ActiveShipmentCount {
		return DeliveryStatusShipped
	}
	// some shipped, some not
	if progress.InTransitCount > 0 || progress.DeliveredCount > 0 {
		return DeliveryStatusPartiallyShipped
	}
	return DeliveryStatusReadyToShip
}

func syncOrderStatusFromShipmentsTx(tx *gorm.DB, order *models.Order, now time.Time) (*orderShipmentSyncResult, error) {
	if tx == nil || order == nil {
		return &orderShipmentSyncResult{}, nil
	}
	progress, err := loadOrderShipmentProgressTx(tx, order.ID)
	if err != nil {
		return nil, err
	}
	result := &orderShipmentSyncResult{
		PreviousOrderStatus:    strings.TrimSpace(order.Status),
		PreviousDeliveryStatus: strings.TrimSpace(order.DeliveryStatus),
	}
	updates := map[string]any{
		"updated_at": now,
	}
	targetStatus := nextOrderStatusFromShipmentProgress(order.Status, order.PaymentStatus, order.FulfillmentType, progress)
	if targetStatus == "" {
		targetStatus = normalizeOrderStatus(order.Status)
	}
	result.CurrentOrderStatus = targetStatus
	if targetStatus != "" && targetStatus != normalizeOrderStatus(order.Status) {
		updates["status"] = targetStatus
		result.OrderStatusChanged = true
	}
	targetDelivery := nextDeliveryStatusFromProgress(order.FulfillmentType, progress)
	if targetDelivery == "" {
		targetDelivery = strings.TrimSpace(order.DeliveryStatus)
	}
	result.CurrentDeliveryStatus = targetDelivery
	if targetDelivery != "" && targetDelivery != strings.TrimSpace(order.DeliveryStatus) {
		updates["delivery_status"] = targetDelivery
		result.DeliveryStatusChanged = true
	}
	if len(updates) <= 1 { // only updated_at
		return result, nil
	}
	if err := tx.Model(&models.Order{}).Where("id = ?", order.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	if result.OrderStatusChanged {
		order.Status = targetStatus
	}
	if result.DeliveryStatusChanged {
		order.DeliveryStatus = targetDelivery
	}
	return result, nil
}
