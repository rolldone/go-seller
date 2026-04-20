package services

import "gorm.io/gorm"

// SearchService provides full-text search over the search_index table.
type SearchService struct {
	DB *gorm.DB
}

// New returns a new SearchService bound to the given DB.
func New(db *gorm.DB) *SearchService {
	return &SearchService{DB: db}
}
