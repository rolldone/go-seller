package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"go_framework/internal/uuid"
	ordermodels "go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

// ShipmentService handles order shipment (resi) logic.
type ShipmentService struct {
	DB *gorm.DB
}

func NewShipmentService(db *gorm.DB) *ShipmentService {
	return &ShipmentService{DB: db}
}

// CreateShipmentInput is the payload for creating a new shipment.
type CreateShipmentInput struct {
	OrderID           string  `json:"order_id"`
	CarrierName       string  `json:"carrier_name"`
	ServiceName       string  `json:"service_name"`
	TrackingNumber    string  `json:"tracking_number"`
	ShippingAmount    float64 `json:"shipping_amount"`
	EstimatedDelivery string  `json:"estimated_delivery"`
	Description       string  `json:"description"`
	Notes             string  `json:"notes"`
	// IDs of order_items to include (must all be non-digital)
	ItemIDs []string `json:"item_ids"`
}

// UpdateShipmentInput is the payload for updating an existing shipment.
type UpdateShipmentInput struct {
	CarrierName       *string  `json:"carrier_name"`
	ServiceName       *string  `json:"service_name"`
	TrackingNumber    *string  `json:"tracking_number"`
	ShippingAmount    *float64 `json:"shipping_amount"`
	EstimatedDelivery *string  `json:"estimated_delivery"`
	Description       *string  `json:"description"`
	Notes             *string  `json:"notes"`
	Status            *string  `json:"status"`
}

// ListShipments returns all shipments for a given order, with their items.
func (s *ShipmentService) ListShipments(ctx context.Context, orderID string) ([]ordermodels.OrderShipment, error) {
	var shipments []ordermodels.OrderShipment
	err := s.DB.WithContext(ctx).
		Preload("Items").
		Where("order_id = ?", orderID).
		Order("created_at ASC").
		Find(&shipments).Error
	return shipments, err
}

// GetShipmentByID returns a single shipment with its items.
func (s *ShipmentService) GetShipmentByID(ctx context.Context, id string) (*ordermodels.OrderShipment, error) {
	var shipment ordermodels.OrderShipment
	err := s.DB.WithContext(ctx).
		Preload("Items").
		Where("id = ?", id).
		First(&shipment).Error
	if err != nil {
		return nil, err
	}
	return &shipment, nil
}

// CreateShipment creates a new shipment and links the specified order items.
// Only non-digital items are allowed.
func (s *ShipmentService) CreateShipment(ctx context.Context, input CreateShipmentInput) (*ordermodels.OrderShipment, error) {
	if input.OrderID == "" {
		return nil, errors.New("order_id is required")
	}
	if len(input.ItemIDs) == 0 {
		return nil, errors.New("at least one item_id is required")
	}

	// Verify all items belong to the order and are not digital
	var items []ordermodels.OrderItem
	if err := s.DB.WithContext(ctx).
		Where("id IN ? AND order_id = ?", input.ItemIDs, input.OrderID).
		Find(&items).Error; err != nil {
		return nil, err
	}
	if len(items) != len(input.ItemIDs) {
		return nil, errors.New("one or more item_ids not found in this order")
	}
	for _, item := range items {
		if item.ProductType == "digital" {
			return nil, errors.New("digital items cannot be added to a shipment")
		}
	}

	shipmentID, err := uuid.New()
	if err != nil {
		return nil, err
	}

	shipment := &ordermodels.OrderShipment{
		ID:                shipmentID,
		OrderID:           input.OrderID,
		CarrierName:       input.CarrierName,
		ServiceName:       input.ServiceName,
		TrackingNumber:    input.TrackingNumber,
		ShippingAmount:    input.ShippingAmount,
		EstimatedDelivery: input.EstimatedDelivery,
		Description:       input.Description,
		Notes:             input.Notes,
		Status:            "pending",
	}
	var order ordermodels.Order
	var syncResult *orderShipmentSyncResult

	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(shipment).Error; err != nil {
			return err
		}
		for _, item := range items {
			siID, err := uuid.New()
			if err != nil {
				return err
			}
			si := &ordermodels.OrderShipmentItem{
				ID:          siID,
				ShipmentID:  shipment.ID,
				OrderItemID: item.ID,
				Qty:         item.Qty,
			}
			if err := tx.Create(si).Error; err != nil {
				return err
			}
		}
		if err := tx.Preload("Customer").Where("id = ?", shipment.OrderID).First(&order).Error; err != nil {
			return err
		}
		result, err := syncOrderStatusFromShipmentsTx(tx, &order, time.Now())
		if err != nil {
			return err
		}
		syncResult = result
		// reload items into struct
		return tx.Preload("Items").Where("id = ?", shipment.ID).First(shipment).Error
	}); err != nil {
		return nil, err
	}
	s.notifyDeliveryStatusChanged(ctx, shipment, &order, syncResult)
	return shipment, nil
}

// UpdateShipment updates shipment metadata (carrier, tracking, status, etc).
func (s *ShipmentService) UpdateShipment(ctx context.Context, id string, input UpdateShipmentInput) (*ordermodels.OrderShipment, error) {
	shipment, err := s.GetShipmentByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("shipment not found")
		}
		return nil, err
	}

	if input.CarrierName != nil {
		shipment.CarrierName = *input.CarrierName
	}
	if input.ServiceName != nil {
		shipment.ServiceName = *input.ServiceName
	}
	if input.TrackingNumber != nil {
		shipment.TrackingNumber = *input.TrackingNumber
	}
	if input.ShippingAmount != nil {
		shipment.ShippingAmount = *input.ShippingAmount
	}
	if input.EstimatedDelivery != nil {
		shipment.EstimatedDelivery = *input.EstimatedDelivery
	}
	if input.Description != nil {
		shipment.Description = *input.Description
	}
	if input.Notes != nil {
		shipment.Notes = *input.Notes
	}
	if input.Status != nil {
		newStatus := strings.ToLower(strings.TrimSpace(*input.Status))
		if newStatus == "processing" {
			newStatus = ShipmentStatusReadyToShip
		}
		switch newStatus {
		case ShipmentStatusPending, ShipmentStatusReadyToShip, ShipmentStatusShipped, ShipmentStatusInTransit, ShipmentStatusDelivered, ShipmentStatusException, ShipmentStatusReturned, ShipmentStatusCancelled:
		default:
			return nil, errors.New("invalid status: must be pending|ready_to_ship|shipped|in_transit|delivered|exception|returned|cancelled")
		}
		shipment.Status = newStatus
		now := time.Now()
		if newStatus == ShipmentStatusShipped && shipment.ShippedAt == nil {
			shipment.ShippedAt = &now
		}
		if newStatus == ShipmentStatusDelivered && shipment.DeliveredAt == nil {
			shipment.DeliveredAt = &now
		}
	}
	var order ordermodels.Order
	var syncResult *orderShipmentSyncResult

	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Save(shipment).Error; err != nil {
			return err
		}
		if err := tx.Preload("Customer").Where("id = ?", shipment.OrderID).First(&order).Error; err != nil {
			return err
		}
		result, err := syncOrderStatusFromShipmentsTx(tx, &order, now)
		if err != nil {
			return err
		}
		syncResult = result
		return nil
	}); err != nil {
		return nil, err
	}
	s.notifyDeliveryStatusChanged(ctx, shipment, &order, syncResult)
	return shipment, nil
}

// DeleteShipment removes a shipment and its item links.
func (s *ShipmentService) DeleteShipment(ctx context.Context, id string) error {
	var order ordermodels.Order
	var deletedShipment ordermodels.OrderShipment
	var syncResult *orderShipmentSyncResult
	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", id).First(&deletedShipment).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("shipment not found")
			}
			return err
		}
		if err := tx.Where("shipment_id = ?", id).Delete(&ordermodels.OrderShipmentItem{}).Error; err != nil {
			return err
		}
		res := tx.Where("id = ?", id).Delete(&ordermodels.OrderShipment{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("shipment not found")
		}
		if err := tx.Preload("Customer").Where("id = ?", deletedShipment.OrderID).First(&order).Error; err != nil {
			return err
		}
		result, err := syncOrderStatusFromShipmentsTx(tx, &order, time.Now())
		if err != nil {
			return err
		}
		syncResult = result
		return nil
	}); err != nil {
		return err
	}
	s.notifyDeliveryStatusChanged(ctx, &deletedShipment, &order, syncResult)
	return nil
}

func (s *ShipmentService) notifyDeliveryStatusChanged(ctx context.Context, shipment *ordermodels.OrderShipment, order *ordermodels.Order, result *orderShipmentSyncResult) {
	if s == nil || s.DB == nil || shipment == nil || order == nil || result == nil || !result.DeliveryStatusChanged {
		return
	}
	currentDelivery := strings.TrimSpace(result.CurrentDeliveryStatus)
	if currentDelivery == "" || strings.EqualFold(currentDelivery, DeliveryStatusNotApplicable) {
		return
	}
	if order.Customer == nil {
		return
	}
	customerEmail := strings.TrimSpace(order.Customer.Email)
	if customerEmail == "" {
		return
	}
	customerName := strings.TrimSpace(order.Customer.Name)
	orderSvc := &OrderService{DB: s.DB}
	businessName := "Go Seller"
	if order.BusinessID != nil {
		businessName = orderSvc.lookupBusinessName(ctx, strings.TrimSpace(*order.BusinessID))
	}
	payload := map[string]any{
		"order_id":                 order.ID,
		"order_number":             order.OrderNumber,
		"order_status":             strings.TrimSpace(order.Status),
		"previous_order_status":    strings.TrimSpace(result.PreviousOrderStatus),
		"delivery_status":          currentDelivery,
		"previous_delivery_status": strings.TrimSpace(result.PreviousDeliveryStatus),
		"customer_email":           customerEmail,
		"customer_name":            customerName,
		"business_name":            businessName,
		"carrier_name":             strings.TrimSpace(shipment.CarrierName),
		"service_name":             strings.TrimSpace(shipment.ServiceName),
		"tracking_number":          strings.TrimSpace(shipment.TrackingNumber),
		"estimated_delivery":       strings.TrimSpace(shipment.EstimatedDelivery),
		"shipment_status":          strings.TrimSpace(shipment.Status),
		"order_link":               "/customer/orders",
	}
	pluginregistry.SendTemplateEventAsync(ctx, s.DB, "delivery_status_changed_customer", payload)
}

// ShippableItems returns order items that are not digital (can be added to a shipment).
func (s *ShipmentService) ShippableItems(ctx context.Context, orderID string) ([]ordermodels.OrderItem, error) {
	var items []ordermodels.OrderItem
	err := s.DB.WithContext(ctx).
		Where("order_id = ? AND (product_type = '' OR product_type != 'digital')", orderID).
		Order("created_at ASC").
		Find(&items).Error
	return items, err
}
