package models

import "time"

type PaymentGatewayHistory struct {
	ID                  string     `gorm:"type:uuid;primaryKey" json:"id"`
	PaymentID           string     `gorm:"type:uuid;index" json:"payment_id"`
	ProviderKey         *string    `gorm:"size:50" json:"provider_key"`
	EventType           string     `gorm:"size:80" json:"event_type"`
	EventStatus         *string    `gorm:"size:24" json:"event_status"`
	ProviderReference   *string    `gorm:"size:120" json:"provider_reference"`
	Payload             []byte     `gorm:"type:jsonb" json:"payload"`
	SignatureValid      *bool      `json:"signature_valid"`
	ActorType           *string    `gorm:"size:20" json:"actor_type"`
	ActorID             *string    `gorm:"size:64" json:"actor_id"`
	EventIdempotencyKey *string    `gorm:"size:120" json:"event_idempotency_key"`
	OccurredAt          *time.Time `json:"occurred_at"`
	ReceivedAt          *time.Time `json:"received_at"`
	CreatedAt           time.Time  `json:"created_at"`
}
