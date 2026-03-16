package models

import (
	"time"

	"gorm.io/gorm"
)

// Admin represents an administrator account.
type Admin struct {
	ID            string         `gorm:"type:uuid;primaryKey" json:"id"`
	Username      string         `gorm:"size:50;uniqueIndex" json:"username"`
	Email         string         `gorm:"size:255;uniqueIndex" json:"email"`
	PasswordHash  string         `gorm:"type:text" json:"-"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	IsSuperAdmin  bool           `gorm:"column:is_superadmin;default:false" json:"is_superadmin"`
	IsActivatedAt *time.Time     `gorm:"column:is_activated_at" json:"is_activated_at,omitempty"`
	IsBanned      bool           `gorm:"column:is_banned;default:false" json:"is_banned"`
	BannedAt      *time.Time     `gorm:"column:banned_at" json:"banned_at,omitempty"`
	BannedUntil   *time.Time     `gorm:"column:banned_until" json:"banned_until,omitempty"`
	BanReason     *string        `gorm:"column:ban_reason;type:text" json:"ban_reason,omitempty"`
	BannedBy      *string        `gorm:"column:banned_by;type:uuid" json:"banned_by,omitempty"`
}
