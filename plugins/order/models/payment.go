package models

import "time"

type Payment struct {
	ID                    string     `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID               string     `gorm:"type:uuid;index" json:"order_id"`
	ProviderID            *string    `gorm:"type:uuid;index" json:"provider_id"`
	ProviderKey           *string    `gorm:"size:50;index" json:"provider_key"`
	PaymentMethodID       *string    `gorm:"type:uuid;index" json:"payment_method_id"`
	PaymentMethod         *string    `gorm:"size:50" json:"payment_method"`
	GatewayName           *string    `gorm:"size:50" json:"gateway_name"`
	GatewayTransactionID  *string    `gorm:"size:120;index" json:"gateway_transaction_id"`
	ProviderTransactionID *string    `gorm:"size:120;index" json:"provider_transaction_id"`
	ExternalReference     *string    `gorm:"size:120" json:"external_reference"`
	Status                string     `gorm:"size:24;index" json:"status"`
	ProofStatus           string     `gorm:"size:20;index" json:"proof_status"`
	Amount                float64    `gorm:"type:numeric(15,2)" json:"amount"`
	FeeAmount             float64    `gorm:"type:numeric(15,2)" json:"fee_amount"`
	NetAmount             float64    `gorm:"type:numeric(15,2)" json:"net_amount"`
	Currency              string     `gorm:"size:8" json:"currency"`
	IdempotencyKey        *string    `gorm:"size:120;uniqueIndex" json:"idempotency_key"`
	RequestPayload        []byte     `gorm:"type:jsonb" json:"request_payload"`
	ResponsePayload       []byte     `gorm:"type:jsonb" json:"response_payload"`
	Metadata              []byte     `gorm:"type:jsonb" json:"metadata"`
	PaidAt                *time.Time `json:"paid_at"`
	FailedAt              *time.Time `json:"failed_at"`
	ExpiredAt             *time.Time `json:"expired_at"`
	ReconciledAt          *time.Time `json:"reconciled_at"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}
