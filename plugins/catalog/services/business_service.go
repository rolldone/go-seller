package services

import (
	"context"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

func (s *CatalogService) CreateBusiness(ctx context.Context, b *catalogmodels.Business) error {
	if strings.TrimSpace(b.Slug) == "" {
		b.Slug = makeSlug(b.Name)
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(b).Error; err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertBusiness(ctx, tx, b.ID)
	})
}

func (s *CatalogService) ListBusinesses(ctx context.Context, page, limit int) ([]catalogmodels.Business, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	q := s.DB.WithContext(ctx).Model(&catalogmodels.Business{})

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	var rows []catalogmodels.Business
	if err := q.Order("created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) GetBusinessByID(ctx context.Context, id string) (*catalogmodels.Business, error) {
	var out catalogmodels.Business
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) UpdateBusiness(ctx context.Context, b *catalogmodels.Business) error {
	if strings.TrimSpace(b.Slug) == "" {
		b.Slug = makeSlug(b.Name)
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(b).Error; err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertBusiness(ctx, tx, b.ID)
	})
}

func (s *CatalogService) DeleteBusinessByID(ctx context.Context, id string) (int64, error) {
	var affected int64
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("id = ?", id).Delete(&catalogmodels.Business{})
		if res.Error != nil {
			return res.Error
		}
		affected = res.RowsAffected
		if affected == 0 {
			return nil
		}
		return pluginregistry.SearchIndexDeleteBusiness(ctx, tx, id)
	})
	return affected, err
}

// GetBusinessBySlug returns a Business by its slug.
func (s *CatalogService) GetBusinessBySlug(ctx context.Context, slug string) (*catalogmodels.Business, error) {
	var out catalogmodels.Business
	// preload assets and their derivatives so callers can use item.Assets directly
	q := s.DB.WithContext(ctx).Model(&catalogmodels.Business{}).
		Preload("Assets", func(db *gorm.DB) *gorm.DB {
			return db.Order("display_order asc")
		}).
		Preload("Assets.Derivatives")

	if err := q.Where("slug = ?", slug).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}
