package models

import (
	"time"

	"gorm.io/gorm"
)

// Discount represents a product-linked pricing adjustment.
type Discount struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	Name              string         `gorm:"size:255" json:"name"`
	Description       *string        `gorm:"type:text" json:"description,omitempty"`
	BusinessID        *string        `gorm:"type:uuid;index" json:"business_id,omitempty"`
	DiscountType      string         `gorm:"type:discount_type_enum;default:'percentage'" json:"discount_type"`
	DiscountValue     float64        `gorm:"type:numeric(15,2);default:0" json:"discount_value"`
	MaxDiscountAmount *float64       `gorm:"type:numeric(15,2)" json:"max_discount_amount,omitempty"`
	Priority          int            `gorm:"default:0" json:"priority"`
	StartAt           time.Time      `gorm:"column:start_at" json:"start_at"`
	EndAt             *time.Time     `gorm:"column:end_at" json:"end_at,omitempty"`
	ProductID         *string        `gorm:"type:uuid;index;constraint:OnDelete:CASCADE" json:"product_id,omitempty"`
	Product           *Product       `gorm:"foreignKey:ProductID" json:"-"`
	ProductIDs        []string       `gorm:"-" json:"product_ids,omitempty"`
	Products          []Product      `gorm:"many2many:discount_products;" json:"products,omitempty"`
	ProductMinQty     *int           `gorm:"column:product_min_qty" json:"product_min_qty,omitempty"`
	ProductQtyLimit   *int           `gorm:"column:product_qty_limit" json:"product_qty_limit,omitempty"`
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
