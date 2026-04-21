package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ProductTranslation stores localized product content.
type ProductTranslation struct {
	ID                string          `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID         string          `gorm:"type:uuid;index:idx_product_locale,unique" json:"product_id"`
	Locale            string          `gorm:"size:8;index:idx_product_locale,unique" json:"locale"`
	Name              string          `gorm:"size:255" json:"name"`
	Slug              string          `gorm:"size:255" json:"slug"`
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
