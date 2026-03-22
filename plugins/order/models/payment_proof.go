package models

import "time"

type PaymentProof struct {
	ID                string     `gorm:"type:uuid;primaryKey" json:"id"`
	PaymentID         string     `gorm:"type:uuid;index" json:"payment_id"`
	OrderID           string     `gorm:"type:uuid;index" json:"order_id"`
	StorageBucket     *string    `gorm:"size:120" json:"storage_bucket"`
	StorageKey        string     `gorm:"type:text" json:"storage_key"`
	PublicURL         *string    `gorm:"type:text" json:"public_url"`
	MimeType          string     `gorm:"size:80" json:"mime_type"`
	FileSize          int64      `json:"file_size"`
	ChecksumSHA256    *string    `gorm:"size:64" json:"checksum_sha256"`
	Notes             *string    `gorm:"type:text" json:"notes"`
	Status            string     `gorm:"size:20;index" json:"status"`
	UploadedByAdminID *string    `gorm:"type:uuid" json:"uploaded_by_admin_id"`
	ReviewedByAdminID *string    `gorm:"type:uuid" json:"reviewed_by_admin_id"`
	ReviewedAt        *time.Time `json:"reviewed_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	DeletedAt         *time.Time `json:"deleted_at,omitempty"`
}
