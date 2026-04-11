package models

import (
	"time"

	"gorm.io/gorm"
)

// BusinessAssetFolder represents hierarchical folders for organizing business assets.
type BusinessAssetFolder struct {
	ID         string  `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string  `gorm:"type:uuid;index" json:"business_id"`
	ParentID   *string `gorm:"type:uuid;index" json:"parent_id,omitempty"`
	Name       string  `gorm:"size:120;not null" json:"name"`
	Slug       string  `gorm:"size:160;not null" json:"slug"`
	Path       string  `gorm:"type:text;not null;index" json:"path"`

	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
