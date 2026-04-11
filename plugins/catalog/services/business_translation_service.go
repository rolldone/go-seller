package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func normalizeBusinessLocale(locale string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(locale))
	switch value {
	case "id", "en":
		return value, nil
	default:
		return "", errors.New("locale must be one of: id, en")
	}
}

func (s *CatalogService) UpsertBusinessTranslation(ctx context.Context, businessID string, locale string, shortDescription *string, highlights datatypes.JSON, storyHTML *string, storyPlain *string, storyBlocks datatypes.JSON) (*catalogmodels.BusinessTranslation, error) {
	normalizedLocale, err := normalizeBusinessLocale(locale)
	if err != nil {
		return nil, err
	}

	var row catalogmodels.BusinessTranslation
	err = s.DB.WithContext(ctx).Where("business_id = ? AND locale = ?", businessID, normalizedLocale).First(&row).Error
	now := time.Now()
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		row = catalogmodels.BusinessTranslation{
			ID:               uuid.NewString(),
			BusinessID:       businessID,
			Locale:           normalizedLocale,
			ShortDescription: shortDescription,
			Highlights:       highlights,
			StoryHTML:        storyHTML,
			StoryPlain:       storyPlain,
			StoryBlocks:      storyBlocks,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		if err := s.DB.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}

	row.ShortDescription = shortDescription
	row.Highlights = highlights
	row.StoryHTML = storyHTML
	row.StoryPlain = storyPlain
	row.StoryBlocks = storyBlocks
	row.UpdatedAt = now
	if err := s.DB.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *CatalogService) ListBusinessTranslations(ctx context.Context, businessID string) ([]catalogmodels.BusinessTranslation, error) {
	var rows []catalogmodels.BusinessTranslation
	if err := s.DB.WithContext(ctx).Where("business_id = ?", businessID).Order("locale ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *CatalogService) GetBusinessTranslationMapByBusinessIDs(ctx context.Context, businessIDs []string, locale string) (map[string]catalogmodels.BusinessTranslation, error) {
	result := make(map[string]catalogmodels.BusinessTranslation)
	if len(businessIDs) == 0 {
		return result, nil
	}

	normalizedLocale, err := normalizeBusinessLocale(locale)
	if err != nil {
		return result, nil
	}

	var rows []catalogmodels.BusinessTranslation
	if err := s.DB.WithContext(ctx).Where("business_id IN ? AND locale = ?", businessIDs, normalizedLocale).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.BusinessID] = row
	}
	return result, nil
}
