package models

import "time"

type CartItem struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	CartID       string    `gorm:"type:uuid;index" json:"cart_id"`
	ProductID    *string   `gorm:"type:uuid;index" json:"product_id"`
	ProductName  string    `gorm:"size:255" json:"product_name"`
	BusinessName string    `gorm:"size:255" json:"business_name,omitempty"`
	VariationID  *string   `gorm:"type:uuid;index" json:"variation_id,omitempty"`
	SKU          *string   `gorm:"size:100" json:"sku,omitempty"`
	ImageURL     *string   `gorm:"type:text" json:"image_url,omitempty"`
	Qty          int       `json:"qty"`
	UnitPrice    float64   `gorm:"type:numeric(15,2)" json:"unit_price"`
	Total        float64   `gorm:"type:numeric(15,2)" json:"total_price"`
	Notes        *string   `json:"notes"`
	Metadata     []byte    `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
