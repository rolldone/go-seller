package models

import "time"

type OrderTransaction struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID   string    `gorm:"type:uuid;index" json:"order_id"`
	PaymentID *string   `gorm:"type:uuid;index" json:"payment_id"`
	Type      string    `gorm:"size:40;index" json:"transaction_type"`
	Status    string    `gorm:"size:24;index" json:"status"`
	Amount    float64   `gorm:"type:numeric(15,2)" json:"amount"`
	Currency  string    `gorm:"size:8" json:"currency"`
	Reference *string   `gorm:"size:120" json:"reference"`
	Payload   []byte    `gorm:"type:jsonb" json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}
