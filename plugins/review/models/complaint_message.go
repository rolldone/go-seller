package models

import "time"

type ComplaintMessage struct {
	ID              string    `gorm:"type:uuid;primaryKey" json:"id"`
	ComplaintCaseID string    `gorm:"type:uuid;index;not null" json:"complaint_case_id"`
	SenderType      string    `gorm:"size:24;index;not null" json:"sender_type"`
	SenderID        string    `gorm:"type:uuid;index;not null" json:"sender_id"`
	SenderName      string    `gorm:"size:200;not null" json:"sender_name"`
	Body            string    `gorm:"type:text;not null" json:"body"`
	IsInternal      bool      `gorm:"not null;default:false" json:"is_internal"`
	CreatedAt       time.Time `gorm:"index" json:"created_at"`
}

func (ComplaintMessage) TableName() string {
	return "complaint_messages"
}

const (
	ComplaintSenderTypeCustomer = "customer"
	ComplaintSenderTypeMember   = "member"
	ComplaintSenderTypeAdmin    = "admin"
)
