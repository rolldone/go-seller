package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// ProductVariation represents a variation of a product (e.g., specific size/color combination).
type ProductVariation struct {
	ID               string          `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID        string          `gorm:"type:uuid;index" json:"product_id"`
	SKU              string          `gorm:"size:100;uniqueIndex" json:"sku"`
	Price            float64         `gorm:"type:numeric(15,2)" json:"price"`
	ComparePrice     *float64        `gorm:"type:numeric(15,2)" json:"compare_price,omitempty"`
	Weight           *float64        `gorm:"type:numeric(10,3)" json:"weight,omitempty"`
	DimensionsLength *float64        `gorm:"type:numeric(10,2)" json:"dimensions_length,omitempty"`
	DimensionsWidth  *float64        `gorm:"type:numeric(10,2)" json:"dimensions_width,omitempty"`
	DimensionsHeight *float64        `gorm:"type:numeric(10,2)" json:"dimensions_height,omitempty"`
	IsDefault        bool            `gorm:"default:false" json:"is_default"`
	IsActive         bool            `gorm:"default:true" json:"is_active"`
	Metadata         json.RawMessage `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt        time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time       `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt        gorm.DeletedAt  `gorm:"index" json:"-"`

	// Relations
	Product    *Product       `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Attributes []Attribute    `gorm:"many2many:variation_attributes;foreignKey:ID;joinForeignKey:ProductVariationID;References:ID;joinReferences:AttributeID" json:"attributes,omitempty"`
	Assets     []ProductAsset `gorm:"many2many:variation_assets;foreignKey:ID;joinForeignKey:ProductVariationID;References:ID;joinReferences:AssetID" json:"assets,omitempty"`
}

// TableName specifies the table name for ProductVariation.
func (pv *ProductVariation) TableName() string {
	return "product_variations"
}
