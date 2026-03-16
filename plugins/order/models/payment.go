package models

import "time"

type Payment struct {
	ID                   string     `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID              string     `gorm:"type:uuid;index" json:"order_id"`
	PaymentMethod        *string    `gorm:"size:50" json:"payment_method"`
	GatewayName          *string    `gorm:"size:50" json:"gateway_name"`
	GatewayTransactionID *string    `gorm:"size:120;index" json:"gateway_transaction_id"`
	Status               string     `gorm:"size:24;index" json:"status"`
	Amount               float64    `gorm:"type:numeric(15,2)" json:"amount"`
	Currency             string     `gorm:"size:8" json:"currency"`
	IdempotencyKey       *string    `gorm:"size:120;uniqueIndex" json:"idempotency_key"`
	RequestPayload       []byte     `gorm:"type:jsonb" json:"request_payload"`
	ResponsePayload      []byte     `gorm:"type:jsonb" json:"response_payload"`
	PaidAt               *time.Time `json:"paid_at"`
	FailedAt             *time.Time `json:"failed_at"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}
