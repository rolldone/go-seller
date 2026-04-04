package models

import (
	"time"
)

// VariationAsset represents an asset (image) associated with a specific product variation.
type VariationAsset struct {
	ID                 string    `gorm:"type:uuid;primaryKey" json:"id"`
	ProductVariationID string    `gorm:"type:uuid;index" json:"product_variation_id"`
	AssetID            string    `gorm:"type:uuid;index" json:"asset_id"`
	IsMain             bool      `gorm:"default:false" json:"is_main"`
	DisplayOrder       int       `gorm:"default:0" json:"display_order"`
	CreatedAt          time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	ProductVariation *ProductVariation `gorm:"foreignKey:ProductVariationID" json:"product_variation,omitempty"`
	Asset            *ProductAsset     `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
}

// TableName specifies the table name for VariationAsset.
func (va *VariationAsset) TableName() string {
	return "variation_assets"
}
