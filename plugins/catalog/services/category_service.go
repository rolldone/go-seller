package services

import (
	"context"
	"strings"
	"time"

	catalogmodels "go_framework/plugins/catalog/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

func (s *CatalogService) CreateCategory(ctx context.Context, c *catalogmodels.Category) error {
	if strings.TrimSpace(c.Slug) == "" {
		c.Slug = makeSlug(c.Name)
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(c).Error; err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertCategory(ctx, tx, c.ID)
	})
}

func (s *CatalogService) ListCategories(ctx context.Context, page, limit int, parentID *string, filterByParent bool, withDeleted bool) ([]catalogmodels.Category, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	db := s.DB.WithContext(ctx)
	if withDeleted {
		db = db.Unscoped()
	}
	q := db.Model(&catalogmodels.Category{})
	if filterByParent {
		if parentID == nil || strings.TrimSpace(*parentID) == "" {
			q = q.Where("parent_id IS NULL")
		} else {
			pid := strings.TrimSpace(*parentID)
			q = q.Where("parent_id = ?", pid)
			// Guard against self-parent legacy data so parent never appears in its own child list.
			q = q.Where("id <> ?", pid)
		}
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	var rows []catalogmodels.Category
	if err := q.Order("sort_priority asc, created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) GetCategoryByID(ctx context.Context, id string) (*catalogmodels.Category, error) {
	var out catalogmodels.Category
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) UpdateCategory(ctx context.Context, c *catalogmodels.Category) error {
	if strings.TrimSpace(c.Slug) == "" {
		c.Slug = makeSlug(c.Name)
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(c).Error; err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertCategory(ctx, tx, c.ID)
	})
}

func (s *CatalogService) DeleteCategoryByID(ctx context.Context, id string) (int64, error) {
	var affected int64
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("id = ?", id).Delete(&catalogmodels.Category{})
		if res.Error != nil {
			return res.Error
		}
		affected = res.RowsAffected
		if affected == 0 {
			return nil
		}
		return pluginregistry.SearchIndexDeleteCategory(ctx, tx, id)
	})
	return affected, err
}

func (s *CatalogService) RestoreCategoryByID(ctx context.Context, id string) (int64, error) {
	var affected int64
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&catalogmodels.Category{}).Unscoped().Where("id = ?", id).Updates(map[string]interface{}{
			"deleted_at": nil,
			"updated_at": time.Now(),
		})
		if res.Error != nil {
			return res.Error
		}
		affected = res.RowsAffected
		if affected == 0 {
			return nil
		}
		return pluginregistry.SearchIndexUpsertCategory(ctx, tx, id)
	})
	return affected, err
}
