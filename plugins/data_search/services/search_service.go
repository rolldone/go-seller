package services

import (
	"context"
	"strings"

	dsmodels "go_framework/plugins/data_search/models"
)

// SearchResult is a single item returned by a full-text search query.
type SearchResult struct {
	EntityType string  `json:"entity_type"`
	EntityID   string  `json:"entity_id"`
	Title      string  `json:"title"`
	Slug       string  `json:"slug"`
	BusinessID *string `json:"business_id,omitempty"`
	Rank       float64 `json:"rank"`
}

// SearchFilter defines parameters for a full-text search query.
type SearchFilter struct {
	Query      string   // raw search query
	Types      []string // optional: filter by entity_type values
	BusinessID string   // optional: limit products to a specific business
	Limit      int
	Offset     int
}

// Search runs a Postgres full-text search against the search_index table.
// It returns results ranked by ts_rank and honours soft-deletes (deleted_at IS NULL).
func (s *SearchService) Search(ctx context.Context, f SearchFilter) ([]SearchResult, int64, error) {
	q := strings.TrimSpace(f.Query)
	if q == "" {
		return nil, 0, nil
	}

	// Convert plain query into a tsquery (each word gets OR-combined with | and
	// prefix matching via :* so "mie" matches "mie ayam", etc.)
	words := strings.Fields(q)
	tsq := strings.Join(words, ":* | ") + ":*"

	limit := f.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	base := s.DB.WithContext(ctx).
		Table("search_index").
		Where("deleted_at IS NULL").
		Where("search_vec @@ to_tsquery('simple', ?)", tsq)

	if len(f.Types) > 0 {
		base = base.Where("entity_type IN ?", f.Types)
	}
	if f.BusinessID != "" {
		base = base.Where("business_id = ? OR entity_type != 'product'", f.BusinessID)
	}

	var total int64
	if err := base.Model(&dsmodels.SearchIndex{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	rows := []struct {
		dsmodels.SearchIndex
		Rank float64 `gorm:"column:rank"`
	}{}

	err := base.
		Select("id, entity_type, entity_id, title, slug, business_id, created_at, updated_at, deleted_at, ts_rank(search_vec, to_tsquery('simple', ?)) AS rank", tsq).
		Order("rank DESC").
		Limit(limit).
		Offset(f.Offset).
		Find(&rows).Error
	if err != nil {
		return nil, 0, err
	}

	out := make([]SearchResult, 0, len(rows))
	for _, r := range rows {
		out = append(out, SearchResult{
			EntityType: r.EntityType,
			EntityID:   r.EntityID,
			Title:      r.Title,
			Slug:       r.Slug,
			BusinessID: r.BusinessID,
			Rank:       r.Rank,
		})
	}

	return out, total, nil
}
