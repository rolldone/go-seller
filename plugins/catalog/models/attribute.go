package models

import (
	"time"

	"gorm.io/gorm"
)

// Attribute represents a specific attribute value within a group (e.g., Red, Blue for Color group).
type Attribute struct {
	ID               string         `gorm:"type:uuid;primaryKey" json:"id"`
	AttributeGroupID string         `gorm:"type:uuid;index" json:"attribute_group_id"`
	Name             string         `gorm:"size:255" json:"name"`
	Slug             string         `gorm:"size:255" json:"slug"`
	Description      *string        `gorm:"type:text" json:"description,omitempty"`
	DisplayOrder     int            `gorm:"default:0" json:"display_order"`
	IsActive         bool           `gorm:"default:true" json:"is_active"`
	CreatedAt        time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	AttributeGroup *AttributeGroup `gorm:"foreignKey:AttributeGroupID" json:"attribute_group,omitempty"`
}

// TableName specifies the table name for Attribute.
func (a *Attribute) TableName() string {
	return "attributes"
}
