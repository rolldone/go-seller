package models

import "time"

type ComplaintReminderLog struct {
	ID                    string     `gorm:"type:uuid;primaryKey" json:"id"`
	ReminderKey           string     `gorm:"size:255;uniqueIndex;not null" json:"reminder_key"`
	ComplaintCaseID       string     `gorm:"type:uuid;index;not null" json:"complaint_case_id"`
	OrderID               string     `gorm:"type:uuid;index;not null" json:"order_id"`
	OrderNumber           string     `gorm:"size:50;index;not null" json:"order_number"`
	ComplaintSubject      string     `gorm:"size:200;not null" json:"complaint_subject"`
	SenderType            string     `gorm:"size:24;index;not null" json:"sender_type"`
	RecipientType         string     `gorm:"size:24;index;not null" json:"recipient_type"`
	RecipientRefID        string     `gorm:"type:uuid;index;not null" json:"recipient_ref_id"`
	RecipientLabel        string     `gorm:"size:200;not null" json:"recipient_label"`
	RecipientEmails       string     `gorm:"type:text;not null" json:"recipient_emails"`
	ExpectedLastMessageAt time.Time  `gorm:"index;not null" json:"expected_last_message_at"`
	DueAt                 time.Time  `gorm:"index;not null" json:"due_at"`
	Status                string     `gorm:"size:24;index;not null;default:'queued'" json:"status"`
	AttemptCount          int        `gorm:"not null;default:0" json:"attempt_count"`
	LastError             *string    `gorm:"type:text" json:"last_error,omitempty"`
	SkipReason            *string    `gorm:"type:text" json:"skip_reason,omitempty"`
	SentAt                *time.Time `json:"sent_at,omitempty"`
	SkippedAt             *time.Time `json:"skipped_at,omitempty"`
	NextRunAt             *time.Time `json:"next_run_at,omitempty"`
	CreatedAt             time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

func (ComplaintReminderLog) TableName() string {
	return "complaint_reminder_logs"
}

const (
	ComplaintReminderStatusQueued     = "queued"
	ComplaintReminderStatusProcessing = "processing"
	ComplaintReminderStatusRetrying   = "retrying"
	ComplaintReminderStatusSent       = "sent"
	ComplaintReminderStatusSkipped    = "skipped"
	ComplaintReminderStatusFailed     = "failed"

	ComplaintReminderRecipientTypeCustomer = "customer"
	ComplaintReminderRecipientTypeBusiness = "business"
)
