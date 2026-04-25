package models

import "time"

// OrderExtraCharge stores additional custom charges attached to an order.
type OrderExtraCharge struct {
	ID               string    `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID          string    `gorm:"type:uuid;index;not null" json:"order_id"`
	Name             string    `gorm:"size:120;not null" json:"name"`
	Amount           float64   `gorm:"type:numeric(15,2);not null;default:0" json:"amount"`
	Notes            string    `gorm:"type:text;not null;default:''" json:"notes"`
	SortOrder        int       `gorm:"not null;default:0" json:"sort_order"`
	CreatedByAdminID *string   `gorm:"type:uuid;index" json:"created_by_admin_id,omitempty"`
	CreatedAt        time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}
