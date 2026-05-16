package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"go_framework/plugins/setting/models"

	"go_framework/internal/uuid"

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

// GetMany returns raw stored values for multiple keys in a single call.
// Missing keys are filled from the provided defaults map (if present) or with JSON null.
// It returns an error only for unexpected DB errors.
func (s *Service) GetMany(ctx context.Context, scope string, keys []string, defaults map[string][]byte) (map[string][]byte, error) {
	scope = normalizeScope(scope)
	out := make(map[string][]byte, len(keys))
	if len(keys) == 0 {
		return out, nil
	}

	// protect against overly large IN queries
	const maxKeys = 100
	if len(keys) > maxKeys {
		keys = keys[:maxKeys]
	}

	var items []models.Setting
	if err := s.db.WithContext(ctx).Where("scope = ? AND key IN ?", scope, keys).Find(&items).Error; err != nil {
		return nil, err
	}

	for _, it := range items {
		out[it.Key] = it.Value
	}

	for _, k := range keys {
		if _, ok := out[k]; !ok {
			if defaults != nil {
				if d, has := defaults[k]; has {
					out[k] = d
					continue
				}
			}
			out[k] = []byte("null")
		}
	}

	return out, nil
}
