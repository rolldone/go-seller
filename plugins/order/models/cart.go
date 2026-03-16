package models

import "time"

type Cart struct {
	ID         string     `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     string     `gorm:"type:uuid;index" json:"user_id"`
	BusinessID *string    `gorm:"type:uuid;index" json:"business_id"`
	Status     string     `gorm:"size:24;index" json:"status"`
	Metadata   []byte     `gorm:"type:jsonb" json:"metadata"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	DeletedAt  *time.Time `json:"deleted_at"`
}
