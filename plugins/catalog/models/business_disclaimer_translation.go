package models

import (
	"time"

	"gorm.io/gorm"
)

// BusinessDisclaimerTranslation stores localized content for a business disclaimer.
type BusinessDisclaimerTranslation struct {
	ID                   string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessDisclaimerID string         `gorm:"type:uuid;index:idx_disclaimer_locale,unique;not null" json:"business_disclaimer_id"`
	Locale               string         `gorm:"size:8;index:idx_disclaimer_locale,unique;not null" json:"locale"`
	Title                *string        `gorm:"type:text" json:"title,omitempty"`
	ContentHTML          *string        `gorm:"type:text" json:"content_html,omitempty"`
	ContentPlain         *string        `gorm:"type:text" json:"content_plain,omitempty"`
	CreatedAt            time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`

	Disclaimer *BusinessDisclaimer `gorm:"foreignKey:BusinessDisclaimerID" json:"disclaimer,omitempty"`
}
