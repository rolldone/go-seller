package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// BusinessCarouselItem stores one slide/item inside a carousel.
type BusinessCarouselItem struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Image    string `json:"image"`
	Href     string `json:"href"`
}

// BusinessCarousel stores persisted carousel data for a business storefront.
type BusinessCarousel struct {
	ID         string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string         `gorm:"type:uuid;index" json:"businessId"`
	Slot       string         `gorm:"size:50;index" json:"slot"`
	Title      string         `gorm:"size:255" json:"title"`
	Subtitle   *string        `gorm:"type:text" json:"subtitle,omitempty"`
	LayoutType string         `gorm:"size:20;index" json:"layoutType"`
	IsActive   bool           `gorm:"default:true;index" json:"isActive"`
	SortOrder  int            `gorm:"default:0;index" json:"sortOrder"`
	Items      datatypes.JSON `gorm:"type:jsonb" json:"items"`
	CreatedAt  time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}
