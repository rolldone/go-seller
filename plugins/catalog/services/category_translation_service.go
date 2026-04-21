package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

func normalizeCategoryLocale(locale string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(locale))
	switch value {
	case "id", "en":
		return value, nil
	default:
		return "", errors.New("locale must be one of: id, en")
	}
}

func (s *CatalogService) UpsertCategoryTranslation(ctx context.Context, categoryID string, locale string, name string, slug string, seoContent json.RawMessage) (*catalogmodels.CategoryTranslation, error) {
	normalizedLocale, err := normalizeCategoryLocale(locale)
	if err != nil {
		return nil, err
	}

	name = strings.TrimSpace(name)
	slug = strings.TrimSpace(slug)
	if name == "" || slug == "" {
		return nil, errors.New("name and slug are required")
	}

	var row catalogmodels.CategoryTranslation
	err = s.DB.WithContext(ctx).Where("category_id = ? AND locale = ?", categoryID, normalizedLocale).First(&row).Error
	now := time.Now()
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		row = catalogmodels.CategoryTranslation{
			ID:         uuid.NewString(),
			CategoryID: categoryID,
			Locale:     normalizedLocale,
			Name:       name,
			Slug:       slug,
			SEOContent: seoContent,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := s.DB.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}

	row.Name = name
	row.Slug = slug
	row.SEOContent = seoContent
	row.UpdatedAt = now
	if err := s.DB.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *CatalogService) ListCategoryTranslations(ctx context.Context, categoryID string) ([]catalogmodels.CategoryTranslation, error) {
	var rows []catalogmodels.CategoryTranslation
	if err := s.DB.WithContext(ctx).Where("category_id = ?", categoryID).Order("locale ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *CatalogService) GetCategoryTranslationMapByCategoryIDs(ctx context.Context, categoryIDs []string, locale string) (map[string]catalogmodels.CategoryTranslation, error) {
	result := make(map[string]catalogmodels.CategoryTranslation)
	if len(categoryIDs) == 0 {
		return result, nil
	}

	normalizedLocale, err := normalizeCategoryLocale(locale)
	if err != nil {
		return result, nil
	}

	var rows []catalogmodels.CategoryTranslation
	if err := s.DB.WithContext(ctx).Where("category_id IN ? AND locale = ?", categoryIDs, normalizedLocale).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.CategoryID] = row
	}
	return result, nil
}
