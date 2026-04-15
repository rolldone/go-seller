package services

import (
	"context"

	catalogmodels "go_framework/plugins/catalog/models"
)

// CreateBusinessDisclaimer inserts a new disclaimer record.
func (s *CatalogService) CreateBusinessDisclaimer(ctx context.Context, d *catalogmodels.BusinessDisclaimer) error {
	return s.DB.WithContext(ctx).Create(d).Error
}

// ListBusinessDisclaimers returns disclaimers for a business (paged).
func (s *CatalogService) ListBusinessDisclaimers(ctx context.Context, businessID string, page, limit int) ([]catalogmodels.BusinessDisclaimer, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := s.DB.WithContext(ctx).Model(&catalogmodels.BusinessDisclaimer{}).Where("business_id = ?", businessID)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	var rows []catalogmodels.BusinessDisclaimer
	if err := q.Order("sort_order asc, created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// GetBusinessDisclaimerByID fetches a single disclaimer by id.
func (s *CatalogService) GetBusinessDisclaimerByID(ctx context.Context, id string) (*catalogmodels.BusinessDisclaimer, error) {
	var out catalogmodels.BusinessDisclaimer
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateBusinessDisclaimer saves an existing disclaimer.
func (s *CatalogService) UpdateBusinessDisclaimer(ctx context.Context, d *catalogmodels.BusinessDisclaimer) error {
	return s.DB.WithContext(ctx).Save(d).Error
}

// DeleteBusinessDisclaimerByID deletes (soft) a disclaimer by ID.
func (s *CatalogService) DeleteBusinessDisclaimerByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&catalogmodels.BusinessDisclaimer{})
	return res.RowsAffected, res.Error
}

// GetActiveDisclaimersForBusiness returns active disclaimers for public consumption.
func (s *CatalogService) GetActiveDisclaimersForBusiness(ctx context.Context, businessID string) ([]catalogmodels.BusinessDisclaimer, error) {
	var rows []catalogmodels.BusinessDisclaimer
	if err := s.DB.WithContext(ctx).
		Where("business_id = ? AND is_active = true", businessID).
		Order("sort_order asc, created_at desc").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}
