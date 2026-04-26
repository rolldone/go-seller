package models

import (
	"time"

	"gorm.io/gorm"
)

// BusinessMember stores membership relation between a user and a business.
type BusinessMember struct {
	ID         string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string         `gorm:"type:uuid;not null;index" json:"business_id"`
	UserID     string         `gorm:"type:uuid;not null;index" json:"user_id"`
	IsOwner    bool           `gorm:"default:false" json:"is_owner"`
	Role       *string        `gorm:"size:50" json:"role,omitempty"`
	CreatedAt  time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (BusinessMember) TableName() string {
	return "business_members"
}
