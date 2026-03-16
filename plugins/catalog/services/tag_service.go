package services

import (
	"context"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"
)

func (s *CatalogService) CreateTag(ctx context.Context, t *catalogmodels.Tag) error {
	if strings.TrimSpace(t.Slug) == "" {
		t.Slug = makeSlug(t.Name)
	}
	return s.DB.WithContext(ctx).Create(t).Error
}

func (s *CatalogService) ListTags(ctx context.Context, page, limit int) ([]catalogmodels.Tag, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	q := s.DB.WithContext(ctx).Model(&catalogmodels.Tag{})

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	var rows []catalogmodels.Tag
	if err := q.Order("created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) GetTagByID(ctx context.Context, id string) (*catalogmodels.Tag, error) {
	var out catalogmodels.Tag
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) UpdateTag(ctx context.Context, t *catalogmodels.Tag) error {
	if strings.TrimSpace(t.Slug) == "" {
		t.Slug = makeSlug(t.Name)
	}
	return s.DB.WithContext(ctx).Save(t).Error
}

func (s *CatalogService) DeleteTagByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&catalogmodels.Tag{})
	return res.RowsAffected, res.Error
}
