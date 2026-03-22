package models

import (
	authmodels "go_framework/plugins/auth/models"
	"time"
)

// AppliedCoupon stores details of a single coupon applied to an order.
type AppliedCoupon struct {
	Code           string  `json:"code"`
	Category       string  `json:"category"`
	DiscountAmount float64 `json:"discount_amount"`
}

type Order struct {
	ID               string        `gorm:"type:uuid;primaryKey" json:"id"`
	OrderNumber      string        `gorm:"size:50;uniqueIndex" json:"order_number"`
	UserID           *string       `gorm:"type:uuid;index" json:"user_id"`
	CustomerID       *string       `gorm:"type:uuid;index" json:"customer_id"`
	BusinessID       *string       `gorm:"type:uuid;index" json:"business_id"`
	Channel          string        `gorm:"size:24;index" json:"channel"`
	CreatedByAdminID *string       `gorm:"type:uuid;index" json:"created_by_admin_id"`
	Status           string        `gorm:"size:24;index" json:"status"`
	PaymentStatus    string        `gorm:"size:24;index" json:"payment_status"`
	Currency         string        `gorm:"size:8" json:"currency"`
	Subtotal         float64       `gorm:"type:numeric(15,2)" json:"subtotal"`
	DiscountAmount   float64       `gorm:"type:numeric(15,2)" json:"discount_amount"`
	TaxAmount        float64       `gorm:"type:numeric(15,2)" json:"tax_amount"`
	ShippingAmount   float64       `gorm:"type:numeric(15,2)" json:"shipping_amount"`
	GrandTotal       float64       `gorm:"type:numeric(15,2)" json:"grand_total"`
	OrderCoupons     []OrderCoupon `gorm:"foreignKey:OrderID" json:"applied_coupons"`
	Notes            *string       `gorm:"type:text" json:"notes"`
	Metadata         []byte        `gorm:"type:jsonb" json:"metadata"`
	PlacedAt         *time.Time    `json:"placed_at"`
	PaidAt           *time.Time    `json:"paid_at"`
	CancelledAt      *time.Time    `json:"cancelled_at"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
	OrderItems       []OrderItem   `gorm:"foreignKey:OrderID" json:"order_items"`
	Payments         []Payment     `gorm:"foreignKey:OrderID" json:"payments"`
	// Customer relation populated when requested by admin APIs
	Customer *authmodels.Customer `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
}
