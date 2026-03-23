package models

import (
	"time"

	"gorm.io/gorm"
)

// BusinessAssetDerivative stores derivative files (thumbnails, resized versions) for assets.
type BusinessAssetDerivative struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	AssetID   string         `gorm:"type:uuid;index" json:"asset_id"`
	FilePath  string         `gorm:"type:text" json:"file_path"`
	FileType  string         `gorm:"size:10" json:"file_type"`
	MimeType  string         `gorm:"size:100" json:"mime_type"`
	Width     int            `json:"width"`
	Height    int            `json:"height"`
	FileSize  int64          `gorm:"default:0" json:"file_size"`
	Purpose   string         `gorm:"size:50;index" json:"purpose"` // e.g., thumbnail, social
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Back-reference to parent asset (optional preload)
	Asset *BusinessAsset `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
}
