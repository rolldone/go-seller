package models

import "time"

type SellerBalance struct {
	ID        int64     `gorm:"primaryKey" json:"id"`
	SellerID  string    `gorm:"type:uuid;uniqueIndex;not null" json:"seller_id"`
	Balance   int64     `gorm:"default:0" json:"balance"` // in cents/smallest currency unit
	UpdatedAt time.Time `json:"updated_at"`
}

type SellerBalanceMutation struct {
	ID            int64     `gorm:"primaryKey" json:"id"`
	SellerID      string    `gorm:"type:uuid;index;not null" json:"seller_id"`
	MutationType  string    `gorm:"size:50;not null" json:"mutation_type"` // 'credit' or 'debet'
	Amount        int64     `gorm:"not null" json:"amount"`                // always positive, sign determined by mutation_type
	Source        string    `gorm:"size:100;not null" json:"source"`       // 'order', 'withdraw', 'fee', 'admin_adjust', etc.
	ReferenceID   *string   `gorm:"size:100" json:"reference_id"`          // ID dari order, withdrawal, atau transaksi lain
	ReferenceType *string   `gorm:"size:50" json:"reference_type"`         // 'order', 'withdrawal', 'fee', etc.
	Description   *string   `gorm:"type:text" json:"description"`
	BalanceAfter  int64     `gorm:"not null" json:"balance_after"` // saldo setelah mutasi ini
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
}

// MutationType constants
const (
	MutationTypeCredit = "credit"
	MutationTypeDebet  = "debet"
)

// Source constants
const (
	SourceOrder       = "order"
	SourceSettlement  = "settlement"
	SourceWithdraw    = "withdraw"
	SourceFee         = "fee"
	SourceAdminAdjust = "admin_adjust"
)

// ReferenceType constants
const (
	ReferenceTypeOrder      = "order"
	ReferenceTypeSettlement = "settlement"
	ReferenceTypeWithdraw   = "withdrawal"
	ReferenceTypeFee        = "fee"
)

type SellerWithdrawal struct {
	ID                int64      `gorm:"primaryKey" json:"id"`
	SellerID          string     `gorm:"type:uuid;index;not null" json:"seller_id"`
	Amount            int64      `gorm:"not null" json:"amount"`                // in cents
	Status            string     `gorm:"size:50;default:pending" json:"status"` // pending, approved, rejected, processed
	BankName          string     `gorm:"size:100;not null" json:"bank_name"`
	BankAccountNumber string     `gorm:"size:100;not null" json:"bank_account_number"`
	BankAccountName   string     `gorm:"size:200;not null" json:"bank_account_name"`
	Notes             *string    `gorm:"type:text" json:"notes"`
	AdminNotes        *string    `gorm:"type:text" json:"admin_notes"`
	ReviewedByAdminID *string    `gorm:"type:uuid" json:"reviewed_by_admin_id"`
	ReviewedAt        *time.Time `json:"reviewed_at"`
	ProcessedAt       *time.Time `json:"processed_at"`
	CreatedAt         time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type SellerWithdrawalAudit struct {
	ID           int64     `gorm:"primaryKey" json:"id"`
	WithdrawalID int64     `gorm:"index;not null" json:"withdrawal_id"`
	SellerID     string    `gorm:"type:uuid;index;not null" json:"seller_id"`
	Action       string    `gorm:"size:50;not null" json:"action"`
	ActorType    string    `gorm:"size:50;not null" json:"actor_type"`
	ActorID      *string   `gorm:"size:100" json:"actor_id"`
	StatusFrom   *string   `gorm:"size:50" json:"status_from"`
	StatusTo     string    `gorm:"size:50;not null" json:"status_to"`
	Notes        *string   `gorm:"type:text" json:"notes"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

// Withdrawal status constants
const (
	WithdrawalStatusPending   = "pending"
	WithdrawalStatusApproved  = "approved"
	WithdrawalStatusRejected  = "rejected"
	WithdrawalStatusProcessed = "processed"
)

const (
	WithdrawalAuditActionRequested = "requested"
	WithdrawalAuditActionApproved  = "approved"
	WithdrawalAuditActionRejected  = "rejected"
	WithdrawalAuditActionProcessed = "processed"
)
