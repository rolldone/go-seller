package models

import (
	"time"

	"gorm.io/gorm"
)

// ProductAsset stores media files linked to products.
type ProductAsset struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID    string         `gorm:"type:uuid;index" json:"product_id"`
	FilePath     string         `gorm:"type:text" json:"file_path"`     // storage key
	FileType     string         `gorm:"size:10" json:"file_type"`       // image/video/doc
	MimeType     string         `gorm:"size:100" json:"mime_type"`      // image/jpeg, video/mp4
	FileSize     int64          `gorm:"default:0" json:"file_size"`     // bytes
	OriginalName string         `gorm:"type:text" json:"original_name"` // nama file asli
	PublicURL    string         `gorm:"type:text" json:"public_url"`    // URL publik untuk akses
	IsMain       bool           `gorm:"default:false" json:"is_main"`
	UsageTag     string         `gorm:"size:50;index" json:"usage_tag,omitempty"` // e.g., "thumbnail", "social_4_5"
	DisplayOrder int            `gorm:"default:0" json:"display_order"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}
