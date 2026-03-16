package models

import "time"

type PaymentGatewayHistory struct {
	ID                string     `gorm:"type:uuid;primaryKey" json:"id"`
	PaymentID         string     `gorm:"type:uuid;index" json:"payment_id"`
	EventType         string     `gorm:"size:80" json:"event_type"`
	EventStatus       *string    `gorm:"size:24" json:"event_status"`
	ProviderReference *string    `gorm:"size:120" json:"provider_reference"`
	Payload           []byte     `gorm:"type:jsonb" json:"payload"`
	SignatureValid    *bool      `json:"signature_valid"`
	ReceivedAt        *time.Time `json:"received_at"`
	CreatedAt         time.Time  `json:"created_at"`
}
