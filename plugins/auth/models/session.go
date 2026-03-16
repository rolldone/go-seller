package models

import "time"

// Session stores refresh token sessions for accounts.
type Session struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	AccountID   string    `gorm:"type:uuid;index" json:"account_id"`
	AccountType string    `gorm:"size:20" json:"account_type"`
	Token       string    `gorm:"type:text;uniqueIndex" json:"token"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}
