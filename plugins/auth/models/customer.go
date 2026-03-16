package models

import (
	"time"

	"gorm.io/gorm"
)

// Customer represents a customer record managed by auth.
type Customer struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	Name         string         `gorm:"size:100" json:"name"`
	Email        string         `gorm:"size:255;uniqueIndex" json:"email"`
	PasswordHash *string        `gorm:"column:password;type:text" json:"-"`
	GoogleID     *string        `gorm:"column:google_id;type:text" json:"-"`
	FacebookID   *string        `gorm:"column:facebook_id;type:text" json:"-"`
	Phone        string         `gorm:"size:20" json:"phone"`
	Notes        *string        `gorm:"type:text" json:"notes,omitempty"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	IsBanned     bool           `gorm:"default:false" json:"is_banned"`
	BannedAt     *time.Time     `gorm:"column:banned_at" json:"banned_at,omitempty"`
	BannedUntil  *time.Time     `gorm:"column:banned_until" json:"banned_until,omitempty"`
	BanReason    *string        `gorm:"column:ban_reason;type:text" json:"ban_reason,omitempty"`
	BannedBy     *string        `gorm:"column:banned_by;type:uuid" json:"banned_by,omitempty"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}
