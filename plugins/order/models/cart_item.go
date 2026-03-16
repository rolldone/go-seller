package models

import "time"

type CartItem struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	CartID    string    `gorm:"type:uuid;index" json:"cart_id"`
	ProductID *string   `gorm:"type:uuid;index" json:"product_id"`
	Qty       int       `json:"qty"`
	UnitPrice float64   `gorm:"type:numeric(15,2)" json:"unit_price"`
	Total     float64   `gorm:"type:numeric(15,2)" json:"total_price"`
	Notes     *string   `json:"notes"`
	Metadata  []byte    `gorm:"type:jsonb" json:"metadata"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
