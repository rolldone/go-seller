package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"go_framework/plugins/setting/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Service {
	return &Service{db: db}
}

func normalizeScope(scope string) string {
	if scope == "" {
		return "global"
	}
	return scope
}

func (s *Service) GetByKey(ctx context.Context, scope string, key string) (*models.Setting, error) {
	scope = normalizeScope(scope)
	q := s.db.WithContext(ctx).Where("scope = ? AND key = ?", scope, key)

	var out models.Setting
	if err := q.First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Service) Upsert(ctx context.Context, scope string, key string, value []byte, description *string) (*models.Setting, error) {
	scope = normalizeScope(scope)
	if key == "" {
		return nil, errors.New("key is required")
	}
	if len(value) == 0 {
		value = []byte("null")
	}

	now := time.Now()
	existing, err := s.GetByKey(ctx, scope, key)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if existing != nil {
		existing.Value = value
		existing.Description = description
		existing.UpdatedAt = now
		if err := s.db.WithContext(ctx).Save(existing).Error; err != nil {
			return nil, err
		}
		return existing, nil
	}

	payload := &models.Setting{
		ID:          uuid.NewString(),
		Scope:       scope,
		Key:         key,
		Value:       value,
		Description: description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.db.WithContext(ctx).Create(payload).Error; err != nil {
		return nil, err
	}
	return payload, nil
}

type ListFilter struct {
	Scope string
	Query string
	Page  int
	Limit int
}

func (s *Service) List(ctx context.Context, filter ListFilter) ([]models.Setting, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 20
	}

	q := s.db.WithContext(ctx).Model(&models.Setting{})
	if scope := strings.TrimSpace(filter.Scope); scope != "" {
		q = q.Where("scope = ?", normalizeScope(scope))
	}
	if needle := strings.TrimSpace(filter.Query); needle != "" {
		like := "%" + needle + "%"
		q = q.Where("key ILIKE ?", like)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []models.Setting
	if err := q.Order("updated_at desc").Limit(filter.Limit).Offset((filter.Page - 1) * filter.Limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (s *Service) DeleteByKey(ctx context.Context, scope string, key string) error {
	scope = normalizeScope(scope)
	if strings.TrimSpace(key) == "" {
		return errors.New("key is required")
	}
	return s.db.WithContext(ctx).Where("scope = ? AND key = ?", scope, key).Delete(&models.Setting{}).Error
}

// GetOrDefault returns the raw stored value for a setting or the provided default
// when the setting is not found. It returns an error for unexpected DB errors.
func (s *Service) GetOrDefault(ctx context.Context, scope string, key string, defaultValue []byte) ([]byte, error) {
	scope = normalizeScope(scope)
	st, err := s.GetByKey(ctx, scope, key)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return defaultValue, nil
		}
		return nil, err
	}
	return st.Value, nil
}
