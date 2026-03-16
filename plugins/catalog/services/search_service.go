package services

import (
	"context"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"
)

// SearchFacets represents aggregated counts for faceted search.
type SearchFacets struct {
	Status      map[string]int64 `json:"status"`
	StockStatus map[string]int64 `json:"stock_status"`
	Categories  map[string]int64 `json:"categories"`
	Tags        map[string]int64 `json:"tags"`
}

// SearchProductsWithFacets performs a full-text search and returns facets for filtering.
func (s *CatalogService) SearchProductsWithFacets(ctx context.Context, f ProductListFilter) ([]catalogmodels.Product, int64, *SearchFacets, error) {
	products, total, err := s.ListProducts(ctx, f)
	if err != nil {
		return nil, 0, nil, err
	}

	facets, err := s.computeFacets(ctx, f)
	if err != nil {
		return products, total, nil, err
	}

	return products, total, facets, nil
}

func (s *CatalogService) computeFacets(ctx context.Context, f ProductListFilter) (*SearchFacets, error) {
	searchTerm := strings.TrimSpace(f.Query)
	baseQuery := s.DB.WithContext(ctx).Model(&catalogmodels.Product{})
	if f.OnlyPublished {
		baseQuery = baseQuery.Where("status = ?", "published").Where("is_visible = ?", true)
	}
	if searchTerm != "" {
		like := "%" + searchTerm + "%"
		baseQuery = baseQuery.Where(
			"name ILIKE ? OR description ILIKE ? OR short_description ILIKE ? OR id = ?",
			like,
			like,
			like,
			searchTerm,
		)
	}

	facets := &SearchFacets{
		Status:      make(map[string]int64),
		StockStatus: make(map[string]int64),
		Categories:  make(map[string]int64),
		Tags:        make(map[string]int64),
	}

	// Status facet
	var statusRows []struct {
		Status string
		Count  int64
	}
	if err := baseQuery.Select("status, COUNT(*) as count").Group("status").Scan(&statusRows).Error; err == nil {
		for _, row := range statusRows {
			facets.Status[row.Status] = row.Count
		}
	}

	// Stock status facet
	var stockRows []struct {
		StockStatus string `gorm:"column:stock_status"`
		Count       int64
	}
	if err := baseQuery.Select("stock_status, COUNT(*) as count").Group("stock_status").Scan(&stockRows).Error; err == nil {
		for _, row := range stockRows {
			facets.StockStatus[row.StockStatus] = row.Count
		}
	}

	// Categories facet (via join)
	var catRows []struct {
		CategoryID string `gorm:"column:category_id"`
		Count      int64
	}
	catQuery := s.DB.WithContext(ctx).Table("products").
		Joins("INNER JOIN product_category_map ON products.id = product_category_map.product_id")
	if f.OnlyPublished {
		catQuery = catQuery.Where("products.status = ?", "published").Where("products.is_visible = ?", true)
	}
	if searchTerm != "" {
		like := "%" + searchTerm + "%"
		catQuery = catQuery.Where(
			"products.name ILIKE ? OR products.description ILIKE ? OR products.short_description ILIKE ? OR products.id = ?",
			like,
			like,
			like,
			searchTerm,
		)
	}
	if err := catQuery.Select("product_category_map.category_id, COUNT(DISTINCT products.id) as count").
		Group("product_category_map.category_id").Scan(&catRows).Error; err == nil {
		for _, row := range catRows {
			facets.Categories[row.CategoryID] = row.Count
		}
	}

	// Tags facet (via join)
	var tagRows []struct {
		TagID string `gorm:"column:tag_id"`
		Count int64
	}
	tagQuery := s.DB.WithContext(ctx).Table("products").
		Joins("INNER JOIN product_tag_map ON products.id = product_tag_map.product_id")
	if f.OnlyPublished {
		tagQuery = tagQuery.Where("products.status = ?", "published").Where("products.is_visible = ?", true)
	}
	if searchTerm != "" {
		like := "%" + searchTerm + "%"
		tagQuery = tagQuery.Where(
			"products.name ILIKE ? OR products.description ILIKE ? OR products.short_description ILIKE ? OR products.id = ?",
			like,
			like,
			like,
			searchTerm,
		)
	}
	if err := tagQuery.Select("product_tag_map.tag_id, COUNT(DISTINCT products.id) as count").
		Group("product_tag_map.tag_id").Scan(&tagRows).Error; err == nil {
		for _, row := range tagRows {
			facets.Tags[row.TagID] = row.Count
		}
	}

	return facets, nil
}
