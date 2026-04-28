package models

import (
	"time"

	"gorm.io/gorm"
)

// Coupon describes configurable price adjustments tied to time ranges, products, and users.
type Coupon struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	Code              string         `gorm:"size:100;uniqueIndex" json:"code"`
	Name              string         `gorm:"size:255" json:"name"`
	Description       *string        `gorm:"type:text" json:"description,omitempty"`
	BusinessID        *string        `gorm:"type:uuid;index" json:"business_id,omitempty"`
	Category          string         `gorm:"size:50;default:'discount'" json:"category"`
	DiscountType      string         `gorm:"size:20;default:'percentage'" json:"discount_type"`
	DiscountValue     float64        `gorm:"type:numeric(15,2)" json:"discount_value"`
	MaxDiscountAmount *float64       `gorm:"type:numeric(15,2)" json:"max_discount_amount,omitempty"`
	StartAt           time.Time      `gorm:"column:start_at" json:"start_at"`
	EndAt             *time.Time     `gorm:"column:end_at" json:"end_at,omitempty"`
	ProductMinQty     *int           `gorm:"column:product_min_qty" json:"product_min_qty,omitempty"`
	ProductQtyLimit   *int           `gorm:"column:product_qty_limit" json:"product_qty_limit,omitempty"`
	ProductIDs        []string       `gorm:"-" json:"product_ids,omitempty"`
	Products          []Product      `gorm:"many2many:coupon_products;" json:"products,omitempty"`
	MinOrderAmount    *float64       `gorm:"column:min_order_amount;type:numeric(15,2)" json:"min_order_amount,omitempty"`
	PerUserOnly       bool           `gorm:"column:per_user_only;default:false" json:"per_user_only"`
	CustomerID        *string        `gorm:"type:uuid;index" json:"customer_id,omitempty"`
	UsageLimit        *int           `gorm:"column:usage_limit" json:"usage_limit,omitempty"`
	UsageLimitPerUser *int           `gorm:"column:usage_limit_per_user" json:"usage_limit_per_user,omitempty"`
	IsActive          bool           `gorm:"default:true" json:"is_active"`
	CreatedAt         time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}
