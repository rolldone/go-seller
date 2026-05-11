package models

import "time"

type SellerSettlement struct {
	ID             int64      `gorm:"primaryKey" json:"id"`
	SellerID       string     `gorm:"type:uuid;index;not null" json:"seller_id"`
	OrderID        string     `gorm:"type:uuid;uniqueIndex;not null" json:"order_id"`
	GrossAmount    int64      `gorm:"not null" json:"gross_amount"`
	ReleasedAmount int64      `gorm:"not null;default:0" json:"released_amount"`
	ReleaseScope   string     `gorm:"size:50;not null;default:'full'" json:"release_scope"`
	Status         string     `gorm:"size:50;index;not null;default:'pending'" json:"status"`
	Source         string     `gorm:"size:50;not null;default:'settlement'" json:"source"`
	ReferenceID    *string    `gorm:"size:100" json:"reference_id,omitempty"`
	ReferenceType  *string    `gorm:"size:50" json:"reference_type,omitempty"`
	Metadata       []byte     `gorm:"type:jsonb;not null;default:'{}'" json:"metadata,omitempty"`
	AdminID        *string    `gorm:"type:uuid;index" json:"admin_id,omitempty"`
	AdminNote      *string    `gorm:"type:text" json:"admin_note,omitempty"`
	DecidedAt      *time.Time `json:"decided_at,omitempty"`
	ReleasedAt     *time.Time `json:"released_at,omitempty"`
	CreatedAt      time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

const (
	SettlementStatusPending           = "pending"
	SettlementStatusHeld              = "held"
	SettlementStatusPartiallyReleased = "partially_released"
	SettlementStatusReleased          = "released"
	SettlementStatusRefunded          = "refunded"
	SettlementStatusReversed          = "reversed"
)

const (
	SettlementScopeFull              = "full"
	SettlementScopePartial           = "partial"
	SettlementScopeHold              = "hold"
	SettlementScopeRefund            = "refund"
	SettlementScopeReversal          = "reversal"
	SettlementSourceOrder            = "order"
	SettlementSourcePayment          = "payment"
	SettlementSourceDispute          = "dispute"
	SettlementSourceManual           = "manual"
	SettlementDecisionHold           = "hold"
	SettlementDecisionRelease        = "release"
	SettlementDecisionPartialRelease = "partial_release"
	SettlementDecisionRefund         = "refund"
)
