package models

import "time"

type CustomerWalletWithdrawal struct {
	ID                int64      `gorm:"primaryKey" json:"id"`
	CustomerID        string     `gorm:"type:uuid;index;not null" json:"customer_id"`
	RequestedAmount   int64      `gorm:"not null" json:"requested_amount"`
	AdminFee          int64      `gorm:"not null;default:0" json:"admin_fee"`
	OtherFee          int64      `gorm:"not null;default:0" json:"other_fee"`
	NetAmount         int64      `gorm:"not null;default:0" json:"net_amount"`
	Status            string     `gorm:"size:50;index;not null;default:'submitted'" json:"status"`
	BankName          string     `gorm:"size:100;not null" json:"bank_name"`
	BankAccountNumber string     `gorm:"size:100;not null" json:"bank_account_number"`
	BankAccountName   string     `gorm:"size:200;not null" json:"bank_account_name"`
	Notes             *string    `gorm:"type:text" json:"notes"`
	AdminNotes        *string    `gorm:"type:text" json:"admin_notes"`
	ReviewedByAdminID *string    `gorm:"type:uuid;index" json:"reviewed_by_admin_id"`
	ReviewedAt        *time.Time `json:"reviewed_at"`
	PaidByAdminID     *string    `gorm:"type:uuid;index" json:"paid_by_admin_id"`
	PaidAt            *time.Time `json:"paid_at"`
	RejectedByAdminID *string    `gorm:"type:uuid;index" json:"rejected_by_admin_id"`
	RejectedAt        *time.Time `json:"rejected_at"`
	CanceledAt        *time.Time `json:"canceled_at"`
	CreatedAt         time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

const (
	CustomerWalletWithdrawalStatusSubmitted            = "submitted"
	CustomerWalletWithdrawalStatusUnderReview          = "under_review"
	CustomerWalletWithdrawalStatusAwaitingConfirmation = "awaiting_confirmation"
	CustomerWalletWithdrawalStatusApproved             = "approved"
	CustomerWalletWithdrawalStatusPaid                 = "paid"
	CustomerWalletWithdrawalStatusRejected             = "rejected"
	CustomerWalletWithdrawalStatusCanceled             = "canceled"
)
