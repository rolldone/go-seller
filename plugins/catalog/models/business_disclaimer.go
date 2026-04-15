package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// BusinessDisclaimer represents a short disclaimer/note configured per business.
type BusinessDisclaimer struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID   string         `gorm:"type:uuid;index" json:"business_id"`
	Title        *string        `gorm:"type:text" json:"title,omitempty"`
	ContentHTML  *string        `gorm:"type:text" json:"content_html,omitempty"`
	ContentPlain *string        `gorm:"type:text" json:"content_plain,omitempty"`
	IconKey      *string        `gorm:"size:50" json:"icon_key,omitempty"`
	SortOrder    int            `gorm:"default:0" json:"sort_order"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	Metadata     datatypes.JSON `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// Backreference to Business (optional preload)
	Business     *Business                       `gorm:"foreignKey:BusinessID" json:"business,omitempty"`
	Translations []BusinessDisclaimerTranslation `gorm:"foreignKey:BusinessDisclaimerID;constraint:OnDelete:CASCADE" json:"translations,omitempty"`
}
