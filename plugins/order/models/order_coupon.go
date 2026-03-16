package models

import (
	"time"

	"gorm.io/gorm"
)

// OrderCoupon represents a coupon applied to an order as a separate row.
type OrderCoupon struct {
	ID             string         `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID        string         `gorm:"type:uuid;index" json:"order_id"`
	Code           string         `gorm:"size:100;index" json:"code"`
	Category       string         `gorm:"size:50" json:"category"`
	DiscountAmount float64        `gorm:"type:numeric(15,2)" json:"discount_amount"`
	CreatedAt      time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
