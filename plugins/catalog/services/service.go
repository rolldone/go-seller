package services

import (
	"go_framework/internal/storage"

	"gorm.io/gorm"
)

// CatalogService provides operations for catalog resources.
type CatalogService struct {
	DB    *gorm.DB
	Store storage.Store
}

// New returns a new CatalogService bound to a gorm DB instance.
func New(db *gorm.DB, store storage.Store) *CatalogService {
	return &CatalogService{DB: db, Store: store}
}
