package models

import (
	"time"

	"gorm.io/gorm"
)

// BusinessAsset stores media files linked to businesses.
type BusinessAsset struct {
	ID           string `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID   string `gorm:"type:uuid;index" json:"business_id"`
	FilePath     string `gorm:"type:text" json:"file_path"`
	FileType     string `gorm:"size:10" json:"file_type"`
	MimeType     string `gorm:"size:100" json:"mime_type"`
	FileSize     int64  `gorm:"default:0" json:"file_size"`
	OriginalName string `gorm:"type:text" json:"original_name"`
	PublicURL    string `gorm:"type:text" json:"public_url"`
	IsMain       bool   `gorm:"default:false" json:"is_main"`
	UsageTag     string `gorm:"size:50;index" json:"usage_tag,omitempty"`
	DisplayOrder int    `gorm:"default:0" json:"display_order"`

	// Derivatives (thumbnails, resized) linked to this asset
	Derivatives []BusinessAssetDerivative `gorm:"foreignKey:AssetID;constraint:OnDelete:CASCADE" json:"derivatives,omitempty"`

	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Back-reference to owning Business (optional preload)
	Business *Business `gorm:"foreignKey:BusinessID" json:"business,omitempty"`
}
