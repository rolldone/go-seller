package models

import "time"

type Setting struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	Scope       string    `gorm:"size:24;index" json:"scope"`
	Key         string    `gorm:"size:120;index" json:"key"`
	Value       []byte    `gorm:"type:jsonb" json:"value"`
	Description *string   `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
