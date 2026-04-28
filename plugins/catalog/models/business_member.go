package models

import (
	"time"

	authmodels "go_framework/plugins/auth/models"

	"gorm.io/gorm"
)

// BusinessMember stores membership relation between a user and a business.
type BusinessMember struct {
	ID               string           `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string           `gorm:"type:uuid;not null;index" json:"business_id"`
	UserID           string           `gorm:"type:uuid;not null;index" json:"user_id"`
	IsOwner          bool             `gorm:"default:false" json:"is_owner"`
	Role             *string          `gorm:"size:50" json:"role,omitempty"`
	Status           string           `gorm:"size:20;not null;default:active;index" json:"status"`
	InvitedAt        *time.Time       `json:"invited_at,omitempty"`
	StatusChangedAt  *time.Time       `json:"status_changed_at,omitempty"`
	SuspendedAt      *time.Time       `json:"suspended_at,omitempty"`
	SuspensionReason *string          `gorm:"type:text" json:"suspension_reason,omitempty"`
	InvitedBy        *string          `gorm:"type:uuid" json:"invited_by,omitempty"`
	CreatedAt        time.Time        `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time        `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt        gorm.DeletedAt   `gorm:"index" json:"-"`
	User             *authmodels.User `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
}

func (BusinessMember) TableName() string {
	return "business_members"
}
