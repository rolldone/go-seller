package models

import "time"

// OrderDiscount stores a selected product discount for an order item.
type OrderDiscount struct {
	ID             string    `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID        string    `gorm:"type:uuid;index" json:"order_id"`
	OrderItemID    string    `gorm:"type:uuid;uniqueIndex" json:"order_item_id"`
	DiscountID     string    `gorm:"type:uuid;index" json:"discount_id"`
	DiscountName   string    `gorm:"size:255" json:"discount_name"`
	DiscountType   string    `gorm:"size:24" json:"discount_type"`
	DiscountValue  float64   `gorm:"type:numeric(15,2)" json:"discount_value"`
	Priority       int       `gorm:"default:0" json:"priority"`
	DiscountAmount float64   `gorm:"type:numeric(15,2);default:0" json:"discount_amount"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
