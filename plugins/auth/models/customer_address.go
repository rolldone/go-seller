package models

import (
	"time"

	"gorm.io/gorm"
)

type CustomerAddress struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	CustomerID   string         `gorm:"type:uuid;index" json:"customer_id"`
	Label        string         `gorm:"size:80" json:"label"`
	ReceiverName string         `gorm:"size:120" json:"receiver_name"`
	PhoneNumber  string         `gorm:"size:32" json:"phone_number"`
	AddressLine1 string         `gorm:"column:address_line_1;type:text" json:"address_line_1"`
	AddressLine2 *string        `gorm:"column:address_line_2;type:text" json:"address_line_2,omitempty"`
	Subdistrict  *string        `gorm:"size:120" json:"subdistrict,omitempty"`
	District     *string        `gorm:"size:120" json:"district,omitempty"`
	City         string         `gorm:"size:120" json:"city"`
	Province     string         `gorm:"size:120" json:"province"`
	PostalCode   string         `gorm:"size:20" json:"postal_code"`
	Country      string         `gorm:"size:2;default:'ID'" json:"country"`
	Notes        *string        `gorm:"type:text" json:"notes,omitempty"`
	IsPrimary    bool           `gorm:"default:false;index" json:"is_primary"`
	Metadata     []byte         `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}
