package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Category represents hierarchical menu/category data.
type Category struct {
	ID                string          `gorm:"type:uuid;primaryKey" json:"id"`
	ParentID          *string         `gorm:"type:uuid;index" json:"parent_id,omitempty"`
	Name              string          `gorm:"size:100" json:"name"`
	Slug              string          `gorm:"size:100;uniqueIndex" json:"slug"`
	Description       *string         `gorm:"type:text" json:"description,omitempty"`
	DescriptionHTML   *string         `gorm:"type:text" json:"description_html,omitempty"`
	DescriptionPlain  *string         `gorm:"type:text" json:"description_plain,omitempty"`
	DescriptionBlocks datatypes.JSON  `gorm:"type:jsonb" json:"description_blocks,omitempty"`
	ShortDescription  *string         `gorm:"type:text" json:"short_description,omitempty"`
	IconURL           *string         `gorm:"type:text" json:"icon_url,omitempty"`
	SEOContent        json.RawMessage `gorm:"type:jsonb" json:"seo_content,omitempty"`
	SortPriority      int             `gorm:"default:0" json:"sort_priority"`
	CreatedAt         time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time       `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt         gorm.DeletedAt  `gorm:"index" json:"deleted_at,omitempty"`
}
