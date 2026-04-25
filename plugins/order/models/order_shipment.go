package models

import "time"

// OrderShipment represents one shipping record (one resi) for an order.
// An order can have multiple shipments (e.g. items from different warehouses).
// Only physical/service items should be linked; digital items are excluded.
type OrderShipment struct {
	ID                string  `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID           string  `gorm:"type:uuid;index;not null" json:"order_id"`
	CarrierName       string  `gorm:"size:100;not null;default:''" json:"carrier_name"`
	ServiceName       string  `gorm:"size:100;not null;default:''" json:"service_name"`
	TrackingNumber    string  `gorm:"size:200;not null;default:''" json:"tracking_number"`
	ShippingAmount    float64 `gorm:"type:numeric(15,2);not null;default:0" json:"shipping_amount"`
	EstimatedDelivery string  `gorm:"size:100;not null;default:''" json:"estimated_delivery"`
	Description       string  `gorm:"type:text;not null;default:''" json:"description"`
	Notes             string  `gorm:"type:text;not null;default:''" json:"notes"`
	Status            string  `gorm:"size:24;not null;default:'pending'" json:"status"`
	// status: pending | processing | shipped | delivered | cancelled
	ShippedAt   *time.Time          `json:"shipped_at,omitempty"`
	DeliveredAt *time.Time          `json:"delivered_at,omitempty"`
	CreatedAt   time.Time           `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time           `gorm:"autoUpdateTime" json:"updated_at"`
	Items       []OrderShipmentItem `gorm:"foreignKey:ShipmentID" json:"items,omitempty"`
}

// OrderShipmentItem links an order item to a specific shipment.
type OrderShipmentItem struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	ShipmentID  string    `gorm:"type:uuid;index;not null" json:"shipment_id"`
	OrderItemID string    `gorm:"type:uuid;index;not null" json:"order_item_id"`
	Qty         int       `gorm:"not null;default:1" json:"qty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}
