package models

import "time"

// LogDirection indicates whether the event was an inbound webhook or an outbound API call.
type LogDirection string

const (
	LogDirectionInbound  LogDirection = "inbound"
	LogDirectionOutbound LogDirection = "outbound"
)

// LogEventType is the kind of interaction recorded.
type LogEventType string

const (
	LogEventWebhook       LogEventType = "webhook"
	LogEventCreatePayment LogEventType = "create_payment"
	LogEventGetStatus     LogEventType = "get_status"
	LogEventRefund        LogEventType = "refund"
)

// PaymentGatewayTransactionLog records every raw inbound/outbound interaction
// with a payment gateway provider for audit, debug, and reconciliation purposes.
type PaymentGatewayTransactionLog struct {
	ID                    string       `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID            *string      `gorm:"type:uuid;index" json:"business_id,omitempty"`
	ProviderKey           string       `gorm:"size:50;index;not null" json:"provider_key"`
	Direction             LogDirection `gorm:"size:10;index;not null" json:"direction"`
	EventType             LogEventType `gorm:"size:60;index;not null" json:"event_type"`
	ReferenceID           *string      `gorm:"size:120;index" json:"reference_id,omitempty"`
	ProviderTransactionID *string      `gorm:"size:120" json:"provider_transaction_id,omitempty"`
	Status                *string      `gorm:"size:30" json:"status,omitempty"`
	Amount                *int64       `json:"amount,omitempty"`
	Currency              *string      `gorm:"size:8" json:"currency,omitempty"`
	RequestPayload        []byte       `gorm:"type:jsonb;not null;default:'{}'" json:"request_payload"`
	ResponsePayload       []byte       `gorm:"type:jsonb;not null;default:'{}'" json:"response_payload"`
	ErrorMessage          *string      `gorm:"type:text" json:"error_message,omitempty"`
	IPAddress             *string      `gorm:"size:45" json:"ip_address,omitempty"`
	CreatedAt             time.Time    `gorm:"index:idx_pgtxlogs_created_at,sort:desc" json:"created_at"`
}

func (PaymentGatewayTransactionLog) TableName() string {
	return "payment_gateway_transaction_logs"
}
