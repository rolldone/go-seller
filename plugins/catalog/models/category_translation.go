package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// CategoryTranslation stores localized category name, slug, and SEO metadata.
type CategoryTranslation struct {
	ID         string          `gorm:"type:uuid;primaryKey" json:"id"`
	CategoryID string          `gorm:"type:uuid;index:idx_category_locale,unique;not null" json:"category_id"`
	Locale     string          `gorm:"size:8;index:idx_category_locale,unique;not null" json:"locale"`
	Name       string          `gorm:"size:100" json:"name"`
	Slug       string          `gorm:"size:100" json:"slug"`
	SEOContent json.RawMessage `gorm:"type:jsonb" json:"seo_content,omitempty"`
	CreatedAt  time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time       `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt  gorm.DeletedAt  `gorm:"index" json:"-"`
}
