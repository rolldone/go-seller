package services

import (
	"context"
	"errors"
	"time"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

func (s *CatalogService) UpsertBusinessDisclaimerTranslation(ctx context.Context, disclaimerID string, locale string, title *string, contentHTML *string, contentPlain *string) (*catalogmodels.BusinessDisclaimerTranslation, error) {
	normalizedLocale, err := normalizeBusinessLocale(locale)
	if err != nil {
		return nil, err
	}

	var row catalogmodels.BusinessDisclaimerTranslation
	err = s.DB.WithContext(ctx).Where("business_disclaimer_id = ? AND locale = ?", disclaimerID, normalizedLocale).First(&row).Error
	now := time.Now()
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		row = catalogmodels.BusinessDisclaimerTranslation{
			ID:                   uuid.NewString(),
			BusinessDisclaimerID: disclaimerID,
			Locale:               normalizedLocale,
			Title:                title,
			ContentHTML:          contentHTML,
			ContentPlain:         contentPlain,
			CreatedAt:            now,
			UpdatedAt:            now,
		}
		if err := s.DB.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}

	row.Title = title
	row.ContentHTML = contentHTML
	row.ContentPlain = contentPlain
	row.UpdatedAt = now
	if err := s.DB.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *CatalogService) ListBusinessDisclaimerTranslations(ctx context.Context, disclaimerID string) ([]catalogmodels.BusinessDisclaimerTranslation, error) {
	var rows []catalogmodels.BusinessDisclaimerTranslation
	if err := s.DB.WithContext(ctx).Where("business_disclaimer_id = ?", disclaimerID).Order("locale ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *CatalogService) GetBusinessDisclaimerTranslationMapByDisclaimerIDs(ctx context.Context, disclaimerIDs []string, locale string) (map[string]catalogmodels.BusinessDisclaimerTranslation, error) {
	result := make(map[string]catalogmodels.BusinessDisclaimerTranslation)
	if len(disclaimerIDs) == 0 {
		return result, nil
	}

	normalizedLocale, err := normalizeBusinessLocale(locale)
	if err != nil {
		return result, nil
	}

	var rows []catalogmodels.BusinessDisclaimerTranslation
	if err := s.DB.WithContext(ctx).Where("business_disclaimer_id IN ? AND locale = ?", disclaimerIDs, normalizedLocale).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.BusinessDisclaimerID] = row
	}
	return result, nil
}
