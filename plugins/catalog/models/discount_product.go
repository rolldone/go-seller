package models

import "time"

// DiscountProduct keeps track of which products belong to a discount.
type DiscountProduct struct {
	DiscountID string    `gorm:"type:uuid;primaryKey" json:"discount_id"`
	ProductID  string    `gorm:"type:uuid;primaryKey" json:"product_id"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
}
