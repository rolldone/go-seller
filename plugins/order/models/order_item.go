package models

import "time"

type OrderItem struct {
	ID             string  `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID        string  `gorm:"type:uuid;index" json:"order_id"`
	ProductID      *string `gorm:"type:uuid;index" json:"product_id"`
	ProductName    string  `gorm:"size:255" json:"product_name"`
	SKU            *string `gorm:"size:50" json:"sku"`
	Qty            int     `json:"qty"`
	UnitPrice      float64 `gorm:"type:numeric(15,2)" json:"unit_price"`
	DiscountAmount float64 `gorm:"type:numeric(15,2)" json:"discount_amount"`
	// DiscountName is populated from order_discounts when returning order details.
	DiscountName string    `gorm:"-" json:"discount_name"`
	TaxAmount    float64   `gorm:"type:numeric(15,2)" json:"tax_amount"`
	TaxType      string    `gorm:"size:16;default:'exclude'" json:"tax_type"`
	TaxRate      float64   `gorm:"type:numeric(7,4);default:0" json:"tax_rate"`
	LineTotal    float64   `gorm:"type:numeric(15,2)" json:"line_total"`
	Metadata     []byte    `gorm:"type:jsonb" json:"metadata"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
