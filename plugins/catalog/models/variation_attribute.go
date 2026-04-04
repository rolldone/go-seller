package models

import (
	"time"
)

// VariationAttribute represents the join between a ProductVariation and its Attributes.
type VariationAttribute struct {
	ID                 string    `gorm:"type:uuid;primaryKey" json:"id"`
	ProductVariationID string    `gorm:"type:uuid;index" json:"product_variation_id"`
	AttributeID        string    `gorm:"type:uuid;index" json:"attribute_id"`
	CreatedAt          time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// TableName specifies the table name for VariationAttribute.
func (va *VariationAttribute) TableName() string {
	return "variation_attributes"
}
