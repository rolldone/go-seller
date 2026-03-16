package models

import "time"

type WishlistItem struct {
	ID         string    `gorm:"type:uuid;primaryKey" json:"id"`
	WishlistID string    `gorm:"type:uuid;index" json:"wishlist_id"`
	ProductID  *string   `gorm:"type:uuid;index" json:"product_id"`
	CreatedAt  time.Time `json:"created_at"`
}
