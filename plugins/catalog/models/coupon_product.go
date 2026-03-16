package models

import "time"

// CouponProduct keeps track of which products belong to a coupon.
type CouponProduct struct {
	CouponID  string    `gorm:"type:uuid;primaryKey" json:"coupon_id"`
	ProductID string    `gorm:"type:uuid;primaryKey" json:"product_id"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}
