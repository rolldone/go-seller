package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/datatypes"

	"gorm.io/gorm"
)

func normalizeProductLocale(locale string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(locale))
	switch value {
	case "id", "en":
		return value, nil
	default:
		return "", errors.New("locale must be one of: id, en")
	}
}

func (s *CatalogService) UpsertProductTranslation(ctx context.Context, productID string, locale string, name string, slug string, description *string, descriptionHTML *string, descriptionPlain *string, descriptionBlocks datatypes.JSON, shortDescription *string, seoContent json.RawMessage) (*catalogmodels.ProductTranslation, error) {
	normalizedLocale, err := normalizeProductLocale(locale)
	if err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	slug = strings.TrimSpace(slug)
	if name == "" || slug == "" {
		return nil, errors.New("name and slug are required")
	}

	var row catalogmodels.ProductTranslation
	err = s.DB.WithContext(ctx).Where("product_id = ? AND locale = ?", productID, normalizedLocale).First(&row).Error
	now := time.Now()
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		row = catalogmodels.ProductTranslation{
			ID:                uuid.NewString(),
			ProductID:         productID,
			Locale:            normalizedLocale,
			Name:              name,
			Slug:              slug,
			Description:       description,
			DescriptionHTML:   descriptionHTML,
			DescriptionPlain:  descriptionPlain,
			DescriptionBlocks: descriptionBlocks,
			ShortDescription:  shortDescription,
			SEOContent:        seoContent,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		if err := s.DB.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}

	row.Name = name
	row.Slug = slug
	row.Description = description
	row.DescriptionHTML = descriptionHTML
	row.DescriptionPlain = descriptionPlain
	row.DescriptionBlocks = descriptionBlocks
	row.ShortDescription = shortDescription
	row.SEOContent = seoContent
	row.UpdatedAt = now
	if err := s.DB.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *CatalogService) ListProductTranslations(ctx context.Context, productID string) ([]catalogmodels.ProductTranslation, error) {
	var rows []catalogmodels.ProductTranslation
	if err := s.DB.WithContext(ctx).Where("product_id = ?", productID).Order("locale ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *CatalogService) GetProductTranslationMapByProductIDs(ctx context.Context, productIDs []string, locale string) (map[string]catalogmodels.ProductTranslation, error) {
	result := make(map[string]catalogmodels.ProductTranslation)
	if len(productIDs) == 0 {
		return result, nil
	}
	normalizedLocale, err := normalizeProductLocale(locale)
	if err != nil {
		return result, nil
	}
	var rows []catalogmodels.ProductTranslation
	if err := s.DB.WithContext(ctx).Where("product_id IN ? AND locale = ?", productIDs, normalizedLocale).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ProductID] = row
	}
	return result, nil
}
