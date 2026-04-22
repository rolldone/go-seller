package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// CategoryTranslation stores localized category name, slug, and SEO metadata.
type CategoryTranslation struct {
	ID                string          `gorm:"type:uuid;primaryKey" json:"id"`
	CategoryID        string          `gorm:"type:uuid;index:idx_category_locale,unique;not null" json:"category_id"`
	Locale            string          `gorm:"size:8;index:idx_category_locale,unique;not null" json:"locale"`
	Name              string          `gorm:"size:100" json:"name"`
	Slug              string          `gorm:"size:100" json:"slug"`
	Description       *string         `gorm:"type:text" json:"description,omitempty"`
	DescriptionHTML   *string         `gorm:"type:text" json:"description_html,omitempty"`
	DescriptionPlain  *string         `gorm:"type:text" json:"description_plain,omitempty"`
	DescriptionBlocks datatypes.JSON  `gorm:"type:jsonb" json:"description_blocks,omitempty"`
	ShortDescription  *string         `gorm:"type:text" json:"short_description,omitempty"`
	SEOContent        json.RawMessage `gorm:"type:jsonb" json:"seo_content,omitempty"`
	CreatedAt         time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time       `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt         gorm.DeletedAt  `gorm:"index" json:"-"`
}
