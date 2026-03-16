package models

import "time"

// Tag represents product tag metadata.
type Tag struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	Name      string    `gorm:"size:50;uniqueIndex" json:"name"`
	Slug      string    `gorm:"size:50;uniqueIndex" json:"slug"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}
