package models

import "time"

// PaymentMethod represents a user-facing payment option mapped to a specific
// PaymentProvider (gateway/vendor).
type PaymentMethod struct {
	ID         string     `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID *string    `gorm:"type:uuid;index" json:"business_id"`
	ProviderID string     `gorm:"type:uuid;index;not null" json:"provider_id"`
	Name       string     `gorm:"size:80;not null" json:"name"`
	IsActive   bool       `gorm:"index" json:"is_active"`
	SortOrder  int        `gorm:"default:0" json:"sort_order"`
	Config     []byte     `gorm:"type:jsonb;default:'{}'" json:"config"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	DeletedAt  *time.Time `json:"deleted_at,omitempty"`

	Provider *PaymentProvider `gorm:"foreignKey:ProviderID" json:"provider,omitempty"`
}
