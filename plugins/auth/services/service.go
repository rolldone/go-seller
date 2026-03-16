package services

import "gorm.io/gorm"

// AuthService provides basic operations for auth plugin.
type AuthService struct {
	DB *gorm.DB
}

// New returns a new AuthService bound to a gorm DB instance.
func New(db *gorm.DB) *AuthService {
	return &AuthService{DB: db}
}
