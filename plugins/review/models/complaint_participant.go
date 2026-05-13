package models

import "time"

type ComplaintParticipant struct {
	ID              string     `gorm:"type:uuid;primaryKey" json:"id"`
	ComplaintCaseID string     `gorm:"type:uuid;index;not null" json:"complaint_case_id"`
	ParticipantType string     `gorm:"size:24;index;not null" json:"participant_type"`
	ParticipantID   string     `gorm:"type:uuid;not null" json:"participant_id"`
	ParticipantName string     `gorm:"size:200;not null" json:"participant_name"`
	LastReadAt      *time.Time `json:"last_read_at,omitempty"`
	CreatedAt       time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (ComplaintParticipant) TableName() string {
	return "complaint_participants"
}
