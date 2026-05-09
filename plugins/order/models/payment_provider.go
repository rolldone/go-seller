package models

import "time"

type PaymentProvider struct {
	ID                   string     `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID           *string    `gorm:"type:uuid;index" json:"business_id"`
	Name                 string     `gorm:"size:80" json:"name"`
	ProviderKey          string     `gorm:"size:50;index" json:"provider_key"`
	IsActive             bool       `gorm:"index" json:"is_active"`
	Config               []byte     `gorm:"type:jsonb" json:"config"`
	CredentialsEncrypted *string    `gorm:"type:text" json:"credentials_encrypted,omitempty"`
	CreatedByAdminID     *string    `gorm:"type:uuid" json:"created_by_admin_id"`
	UpdatedByAdminID     *string    `gorm:"type:uuid" json:"updated_by_admin_id"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	DeletedAt            *time.Time `json:"deleted_at,omitempty"`
}
