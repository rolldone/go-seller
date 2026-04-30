package models

import (
	"time"

	"gorm.io/gorm"
)

// Payout represents a payout request and its lifecycle.
type Payout struct {
	ID            string         `gorm:"type:uuid;primaryKey" json:"id"`
	MemberID      string         `gorm:"type:uuid;not null;index" json:"member_id"`
	BusinessID    string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BankAccountID *string        `gorm:"type:uuid;index" json:"bank_account_id,omitempty"`
	Amount        float64        `gorm:"type:numeric(15,2);not null" json:"amount"`
	Currency      string         `gorm:"size:8;not null;default:'IDR'" json:"currency"`
	Status        string         `gorm:"size:32;not null;index" json:"status"`
	ExternalID    *string        `gorm:"size:255" json:"external_id,omitempty"`
	FailureReason *string        `gorm:"type:text" json:"failure_reason,omitempty"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"created_at"`
	ProcessedAt   *time.Time     `json:"processed_at,omitempty"`
	UpdatedAt     time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Payout) TableName() string { return "payouts" }
