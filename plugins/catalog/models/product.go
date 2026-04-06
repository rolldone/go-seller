package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Product represents a sellable product in the catalog.
type Product struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	SKU               string         `gorm:"size:50" json:"sku"`
	Name              string         `gorm:"size:255" json:"name"`
	Slug              string         `gorm:"size:255;uniqueIndex" json:"slug"`
	Description       *string        `gorm:"type:text" json:"description,omitempty"`
	DescriptionHTML   *string        `gorm:"type:text" json:"description_html,omitempty"`
	DescriptionPlain  *string        `gorm:"type:text" json:"description_plain,omitempty"`
	DescriptionBlocks datatypes.JSON `gorm:"type:jsonb" json:"description_blocks,omitempty"`
	ShortDescription  *string        `gorm:"type:text" json:"short_description,omitempty"`
	Price             float64        `gorm:"type:numeric(15,2);default:0" json:"price"`
	SalePrice         *float64       `gorm:"type:numeric(15,2)" json:"sale_price,omitempty"`
	// Tax fields
	// tax_type: "include" or "exclude". If empty, treated as "exclude".
	TaxType string `gorm:"size:16;default:'exclude'" json:"tax_type"`
	// tax_rate expressed as decimal (e.g., 0.11 for 11%)
	TaxRate float64 `gorm:"type:numeric(7,4);default:0" json:"tax_rate"`
	// If true, this product has a custom tax rate/type different from global default
	CustomTax bool `gorm:"default:false" json:"custom_tax"`
	// allow price override at POS for this product
	PriceOverride bool            `gorm:"column:price_override_enabled;default:false" json:"price_override_enabled"`
	Status        string          `gorm:"size:20;default:'draft'" json:"status"`
	StockStatus   string          `gorm:"size:20;default:'instock'" json:"stock_status"`
	BusinessID    *string         `gorm:"type:uuid;index" json:"business_id,omitempty"`
	IsVisible     bool            `gorm:"default:true" json:"is_visible"`
	IsNegotiate   bool            `gorm:"default:false" json:"is_negotiate"`
	SEOContent    json.RawMessage `gorm:"type:jsonb" json:"seo_content,omitempty"`
	Attributes    json.RawMessage `gorm:"type:jsonb" json:"attributes,omitempty"`
	ProductType   string          `gorm:"type:product_type_enum;default:'product'" json:"product_type"`
	// Optional default shipping data used when a product has no variation-level dimensions.
	Weight           *float64       `gorm:"type:numeric(10,3)" json:"weight,omitempty"`
	DimensionsLength *float64       `gorm:"type:numeric(10,2)" json:"dimensions_length,omitempty"`
	DimensionsWidth  *float64       `gorm:"type:numeric(10,2)" json:"dimensions_width,omitempty"`
	DimensionsHeight *float64       `gorm:"type:numeric(10,2)" json:"dimensions_height,omitempty"`
	CreatedAt        time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}
