package models

import "time"

type Wishlist struct {
	ID         string    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     string    `gorm:"type:uuid;index" json:"user_id"`
	BusinessID *string   `gorm:"type:uuid;index" json:"business_id"`
	Name       string    `gorm:"size:100" json:"name"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
