package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"go_framework/internal/uuid"
	marketingmodels "go_framework/plugins/marketing/models"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Service provides CRUD operations for marketing resources.
type Service struct {
	DB *gorm.DB
}

// New creates a new marketing service.
func New(db *gorm.DB) *Service {
	return &Service{DB: db}
}

func normalizeCarouselLayoutType(layoutType string) string {
	switch strings.ToLower(strings.TrimSpace(layoutType)) {
	case "medium", "banner":
		return strings.ToLower(strings.TrimSpace(layoutType))
	default:
		return "large"
	}
}

func normalizeCarouselItems(items []marketingmodels.BusinessCarouselItem) (datatypes.JSON, error) {
	normalized := make([]marketingmodels.BusinessCarouselItem, 0, len(items))
	for index, item := range items {
		normalizedItem := marketingmodels.BusinessCarouselItem{
			ID:       strings.TrimSpace(item.ID),
			Title:    strings.TrimSpace(item.Title),
			Subtitle: strings.TrimSpace(item.Subtitle),
			Image:    strings.TrimSpace(item.Image),
			Href:     strings.TrimSpace(item.Href),
		}
		if normalizedItem.ID == "" {
			normalizedItem.ID = fmt.Sprintf("carousel-item-%d", index+1)
		}
		normalized = append(normalized, normalizedItem)
	}
	if normalized == nil {
		normalized = []marketingmodels.BusinessCarouselItem{}
	}
	raw, err := json.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(raw), nil
}

func normalizeCarouselSubtitle(subtitle string) *string {
	trimmed := strings.TrimSpace(subtitle)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// CreateBusinessCarousel inserts a new carousel row.
func (s *Service) CreateBusinessCarousel(ctx context.Context, businessID, slot, title, subtitle, layoutType string, isActive bool, sortOrder int, items []marketingmodels.BusinessCarouselItem) (*marketingmodels.BusinessCarousel, error) {
	if strings.TrimSpace(businessID) == "" {
		return nil, errors.New("businessId is required")
	}
	if strings.TrimSpace(slot) == "" {
		return nil, errors.New("slot is required")
	}

	normalizedItems, err := normalizeCarouselItems(items)
	if err != nil {
		return nil, err
	}

	row := &marketingmodels.BusinessCarousel{
		ID:         uuid.NewString(),
		BusinessID: businessID,
		Slot:       strings.TrimSpace(slot),
		Title:      strings.TrimSpace(title),
		Subtitle:   normalizeCarouselSubtitle(subtitle),
		LayoutType: normalizeCarouselLayoutType(layoutType),
		IsActive:   isActive,
		SortOrder:  sortOrder,
		Items:      normalizedItems,
	}

	if err := s.DB.WithContext(ctx).Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

// UpdateBusinessCarousel updates an existing carousel row.
func (s *Service) UpdateBusinessCarousel(ctx context.Context, id, businessID, slot, title, subtitle, layoutType string, isActive bool, sortOrder int, items []marketingmodels.BusinessCarouselItem) (*marketingmodels.BusinessCarousel, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("id is required")
	}
	if strings.TrimSpace(businessID) == "" {
		return nil, errors.New("businessId is required")
	}
	if strings.TrimSpace(slot) == "" {
		return nil, errors.New("slot is required")
	}

	var row marketingmodels.BusinessCarousel
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&row).Error; err != nil {
		return nil, err
	}

	normalizedItems, err := normalizeCarouselItems(items)
	if err != nil {
		return nil, err
	}

	row.BusinessID = businessID
	row.Slot = strings.TrimSpace(slot)
	row.Title = strings.TrimSpace(title)
	row.Subtitle = normalizeCarouselSubtitle(subtitle)
	row.LayoutType = normalizeCarouselLayoutType(layoutType)
	row.IsActive = isActive
	row.SortOrder = sortOrder
	row.Items = normalizedItems

	if err := s.DB.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// ListBusinessCarousels returns carousels filtered by business and active state.
func (s *Service) ListBusinessCarousels(ctx context.Context, businessID string, onlyActive bool) ([]marketingmodels.BusinessCarousel, error) {
	q := s.DB.WithContext(ctx).Model(&marketingmodels.BusinessCarousel{})
	if strings.TrimSpace(businessID) != "" {
		q = q.Where("business_id = ?", strings.TrimSpace(businessID))
	}
	if onlyActive {
		q = q.Where("is_active = ?", true)
	}

	var rows []marketingmodels.BusinessCarousel
	if err := q.Order("sort_order asc, created_at asc").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// GetBusinessCarouselByID returns a single carousel by id.
func (s *Service) GetBusinessCarouselByID(ctx context.Context, id string) (*marketingmodels.BusinessCarousel, error) {
	var row marketingmodels.BusinessCarousel
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// DeleteBusinessCarouselByID deletes a carousel by id.
func (s *Service) DeleteBusinessCarouselByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).Delete(&marketingmodels.BusinessCarousel{})
	return res.RowsAffected, res.Error
}
