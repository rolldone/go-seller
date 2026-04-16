package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ProductSubscription stores email subscriptions for a business/product.
type ProductSubscription struct {
	ID             string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID     string         `gorm:"type:uuid;index" json:"businessId"`
	ProductID      *string        `gorm:"type:uuid;index" json:"productId,omitempty"`
	CustomerID     *string        `gorm:"type:uuid;index" json:"customerId,omitempty"`
	Email          string         `gorm:"size:255;index" json:"email"`
	Consent        bool           `gorm:"default:true" json:"consent"`
	SubscribedAt   time.Time      `gorm:"index" json:"subscribedAt"`
	UnsubscribedAt *time.Time     `gorm:"index" json:"unsubscribedAt,omitempty"`
	Metadata       datatypes.JSON `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt      time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	IsConfirmed    bool           `gorm:"default:false;index" json:"isConfirmed"`
	ConfirmedAt    *time.Time     `gorm:"index" json:"confirmedAt,omitempty"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
