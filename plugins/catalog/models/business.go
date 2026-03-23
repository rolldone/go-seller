package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Business represents a seller or business owner entity for products.
type Business struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	Name              string         `gorm:"size:150" json:"name"`
	Slug              string         `gorm:"size:150;uniqueIndex" json:"slug"`
	ShortDescription  *string        `gorm:"size:255" json:"short_description,omitempty"`
	DescriptionHTML   *string        `gorm:"type:text" json:"description_html,omitempty"`
	DescriptionPlain  *string        `gorm:"type:text" json:"description_plain,omitempty"`
	DescriptionBlocks datatypes.JSON `gorm:"type:jsonb" json:"description_blocks,omitempty"`
	Highlights        datatypes.JSON `gorm:"type:jsonb" json:"highlights,omitempty"`
	OwnerName         *string        `gorm:"size:255" json:"owner_name,omitempty"`
	OwnerRole         *string        `gorm:"size:255" json:"owner_role,omitempty"`
	FoundedYear       *int           `json:"founded_year,omitempty"`
	Address           *string        `gorm:"type:text" json:"address,omitempty"`
	OperationalHours  datatypes.JSON `gorm:"type:jsonb" json:"operational_hours,omitempty"`
	ChatResponseTime  *string        `gorm:"size:100" json:"chat_response_time,omitempty"`
	Email             *string        `gorm:"size:255" json:"email,omitempty"`
	Phone             *string        `gorm:"size:32" json:"phone,omitempty"`
	ShowContactEmail  bool           `gorm:"default:true" json:"show_contact_email"`
	ShowPhone         bool           `gorm:"default:true" json:"show_phone"`
	Description       *string        `gorm:"type:text" json:"description,omitempty"`
	CreatedAt         time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	// Assets related to this business (one-to-many)
	Assets []BusinessAsset `gorm:"foreignKey:BusinessID;constraint:OnDelete:CASCADE" json:"assets,omitempty"`
}
