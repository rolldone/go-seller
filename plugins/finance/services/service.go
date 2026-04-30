package services

import (
	"go_framework/internal/storage"

	"gorm.io/gorm"
)

// FinanceService provides operations for finance-related resources.
type FinanceService struct {
	DB    *gorm.DB
	Store storage.Store
}

// New returns a new FinanceService bound to a gorm DB instance.
func New(db *gorm.DB, store storage.Store) *FinanceService {
	return &FinanceService{DB: db, Store: store}
}
