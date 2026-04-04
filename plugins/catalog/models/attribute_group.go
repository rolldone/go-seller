package models

import (
	"time"

	"gorm.io/gorm"
)

// AttributeGroup represents a group of product attributes (e.g., Color, Size, Material).
type AttributeGroup struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	Name         string         `gorm:"size:255" json:"name"`
	Slug         string         `gorm:"size:255;uniqueIndex" json:"slug"`
	Description  *string        `gorm:"type:text" json:"description,omitempty"`
	DisplayOrder int            `gorm:"default:0" json:"display_order"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Attributes []Attribute `gorm:"foreignKey:AttributeGroupID" json:"attributes,omitempty"`
}

// TableName specifies the table name for AttributeGroup.
func (ag *AttributeGroup) TableName() string {
	return "attribute_groups"
}
