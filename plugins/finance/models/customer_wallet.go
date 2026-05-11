package models

import "time"

type CustomerWallet struct {
	ID           int64     `gorm:"primaryKey" json:"id"`
	CustomerID   string    `gorm:"type:uuid;uniqueIndex;not null" json:"customer_id"`
	CashBalance  int64     `gorm:"default:0" json:"cash_balance"`
	PromoBalance int64     `gorm:"default:0" json:"promo_balance"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CustomerWalletMutation struct {
	ID            int64     `gorm:"primaryKey" json:"id"`
	CustomerID    string    `gorm:"type:uuid;index;not null" json:"customer_id"`
	BalanceType   string    `gorm:"size:20;not null" json:"balance_type"`
	MutationType  string    `gorm:"size:50;not null" json:"mutation_type"`
	Amount        int64     `gorm:"not null" json:"amount"`
	Source        string    `gorm:"size:100;not null" json:"source"`
	ReferenceID   *string   `gorm:"size:100" json:"reference_id"`
	ReferenceType *string   `gorm:"size:50" json:"reference_type"`
	Description   *string   `gorm:"type:text" json:"description"`
	BalanceAfter  int64     `gorm:"not null" json:"balance_after"`
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
}

const (
	CustomerWalletBalanceTypeCash  = "cash"
	CustomerWalletBalanceTypePromo = "promo"
)

const (
	CustomerWalletMutationTypeCredit = "credit"
	CustomerWalletMutationTypeDebet  = "debet"
)

const (
	CustomerWalletSourceRefund           = "refund"
	CustomerWalletSourcePromo            = "promo"
	CustomerWalletSourceWithdraw         = "withdraw"
	CustomerWalletSourceWithdrawReversal = "withdraw_reversal"
	CustomerWalletSourceAdjustment       = "adjustment"
)

const (
	CustomerWalletReferenceTypeOrder      = "order"
	CustomerWalletReferenceTypeWithdrawal = "withdrawal"
	CustomerWalletReferenceTypeAdjustment = "adjustment"
)
