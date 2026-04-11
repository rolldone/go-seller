package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// BusinessTranslation stores localized business content.
type BusinessTranslation struct {
	ID               string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string         `gorm:"type:uuid;index:idx_business_locale,unique;not null" json:"business_id"`
	Locale           string         `gorm:"size:8;index:idx_business_locale,unique;not null" json:"locale"`
	ShortDescription *string        `gorm:"type:text" json:"short_description,omitempty"`
	Highlights       datatypes.JSON `gorm:"type:jsonb" json:"highlights,omitempty"`
	StoryHTML        *string        `gorm:"type:text" json:"story_html,omitempty"`
	StoryPlain       *string        `gorm:"type:text" json:"story_plain,omitempty"`
	StoryBlocks      datatypes.JSON `gorm:"type:jsonb" json:"story_blocks,omitempty"`
	CreatedAt        time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}
