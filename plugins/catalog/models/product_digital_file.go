package models

import (
	"time"

	"gorm.io/gorm"
)

// ProductDigitalFile holds a downloadable file attached to a digital product.
// Access is gated: the customer must have a paid order containing the product.
type ProductDigitalFile struct {
	ID            string         `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID     string         `gorm:"type:uuid;index;not null" json:"product_id"`
	FilePath      string         `gorm:"type:text;not null" json:"file_path"`
	FileName      string         `gorm:"size:255;not null;default:''" json:"file_name"`
	MimeType      string         `gorm:"size:100;not null;default:''" json:"mime_type"`
	FileSize      int64          `gorm:"default:0" json:"file_size"`
	DownloadLimit int            `gorm:"default:0" json:"download_limit"` // 0 = unlimited
	IsActive      bool           `gorm:"default:true" json:"is_active"`
	SortOrder     int            `gorm:"default:0" json:"sort_order"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}
