package models

import "time"

// SearchIndex stores a pre-computed tsvector row for each entity
// (product, business, category) that is kept in sync via DB triggers.
type SearchIndex struct {
	ID         string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	EntityType string  `gorm:"size:32;not null;uniqueIndex:uq_search_index_entity" json:"entity_type"`
	EntityID   string  `gorm:"type:uuid;not null;uniqueIndex:uq_search_index_entity" json:"entity_id"`
	Title      string  `gorm:"type:text;not null;default:''" json:"title"`
	Slug       string  `gorm:"type:text;not null;default:''" json:"slug"`
	BusinessID *string `gorm:"type:uuid;index" json:"business_id,omitempty"`
	// SearchVec is managed by Postgres triggers; Go reads/scans but never writes it.
	SearchVec string     `gorm:"type:tsvector;not null;default:''" json:"-"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

func (SearchIndex) TableName() string { return "search_index" }
