package models

import (
	"time"

	"gorm.io/gorm"
)

// BankAccount represents a bank account attached to a business for payouts.
type BankAccount struct {
	ID            string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID    string         `gorm:"type:uuid;not null;index" json:"business_id"`
	Bank          string         `gorm:"size:100;not null" json:"bank"`
	AccountNumber string         `gorm:"size:100;not null" json:"account_number"`
	OwnerName     string         `gorm:"size:255;not null" json:"owner_name"`
	IsVerified    bool           `gorm:"default:false" json:"is_verified"`
	IsPrimary     bool           `gorm:"default:false" json:"is_primary"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (BankAccount) TableName() string { return "bank_accounts" }
