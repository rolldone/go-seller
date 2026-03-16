package models

import "time"

// Role groups a set of permissions that can be assigned to admins.
type Role struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `gorm:"size:64;uniqueIndex;not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	IsSystem    bool      `gorm:"column:is_system;default:false" json:"is_system"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// Permission is a granular access string such as products.create.
type Permission struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	Key         string    `gorm:"size:128;uniqueIndex;not null" json:"key"`
	Name        string    `gorm:"size:128;json:\"name\""`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// RolePermission links roles to permissions.
type RolePermission struct {
	RoleID        string    `gorm:"type:uuid;primaryKey" json:"role_id"`
	PermissionKey string    `gorm:"size:128;primaryKey" json:"permission_key"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// AdminRole links admins to roles, with an optional business scope.
type AdminRole struct {
	AdminID         string    `gorm:"type:uuid;primaryKey" json:"admin_id"`
	RoleID          string    `gorm:"type:uuid;primaryKey" json:"role_id"`
	ScopeBusinessID *string   `gorm:"type:uuid;primaryKey" json:"scope_business_id,omitempty"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
}
