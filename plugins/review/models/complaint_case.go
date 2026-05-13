package models

import "time"

type ComplaintCase struct {
	ID            string     `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID       string     `gorm:"type:uuid;index;not null" json:"order_id"`
	CustomerID    string     `gorm:"type:uuid;index;not null" json:"customer_id"`
	Subject       string     `gorm:"size:200;not null" json:"subject"`
	Description   string     `gorm:"type:text;not null" json:"description"`
	Status        string     `gorm:"size:32;index;not null;default:'open'" json:"status"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
	ResolvedAt    *time.Time `json:"resolved_at,omitempty"`
	ClosedAt      *time.Time `json:"closed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (ComplaintCase) TableName() string {
	return "complaint_cases"
}

const (
	ComplaintStatusOpen     = "open"
	ComplaintStatusResolved = "resolved"
	ComplaintStatusClosed   = "closed"
)
