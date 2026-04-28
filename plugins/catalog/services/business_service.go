package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

func (s *CatalogService) CreateBusiness(ctx context.Context, b *catalogmodels.Business) error {
	if strings.TrimSpace(b.Slug) == "" {
		b.Slug = b.Name
	}
	var err error
	b.Slug, err = s.ensureUniqueBusinessSlug(ctx, b.Slug, "")
	if err != nil {
		return err
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

func (s *CatalogService) listBusinessesForMemberQuery(ctx context.Context, memberID string) *gorm.DB {
	return s.DB.WithContext(ctx).
		Model(&catalogmodels.Business{}).
		Joins("JOIN business_members bm ON bm.business_id = businesses.id AND bm.deleted_at IS NULL").
		Select("businesses.*, CASE WHEN bm.invited_by IS NOT NULL AND bm.is_owner = FALSE THEN TRUE ELSE FALSE END AS member_invited").
		Where("bm.user_id = ? AND (bm.is_owner = TRUE OR COALESCE(NULLIF(bm.status, ''), 'active') IN ('active', 'invited'))", memberID)
}

func (s *CatalogService) listBusinessesForMemberAccessQuery(ctx context.Context, memberID string) *gorm.DB {
	return s.DB.WithContext(ctx).
		Model(&catalogmodels.Business{}).
		Joins("JOIN business_members bm ON bm.business_id = businesses.id AND bm.deleted_at IS NULL").
		Select("businesses.*, CASE WHEN bm.invited_by IS NOT NULL AND bm.is_owner = FALSE THEN TRUE ELSE FALSE END AS member_invited").
		Where("bm.user_id = ? AND (bm.is_owner = TRUE OR COALESCE(NULLIF(bm.status, ''), 'active') = 'active')", memberID)
}

func (s *CatalogService) listBusinessesForMemberOwnerQuery(ctx context.Context, memberID string) *gorm.DB {
	return s.DB.WithContext(ctx).
		Model(&catalogmodels.Business{}).
		Joins("JOIN business_members bm ON bm.business_id = businesses.id AND bm.deleted_at IS NULL").
		Where("bm.user_id = ? AND bm.is_owner = TRUE", memberID)
}

func (s *CatalogService) ListBusinessesForMember(ctx context.Context, memberID string, page, limit int) ([]catalogmodels.Business, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	base := s.listBusinessesForMemberQuery(ctx, memberID)

	var total int64
	if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	var rows []catalogmodels.Business
	if err := base.Select("businesses.*, COALESCE(NULLIF(bm.status, ''), 'active') AS member_status, CASE WHEN bm.invited_by IS NOT NULL AND bm.is_owner = FALSE THEN TRUE ELSE FALSE END AS member_invited").Order("businesses.created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) ListBusinessIDsForMember(ctx context.Context, memberID string) ([]string, error) {
	var ids []string
	if err := s.listBusinessesForMemberQuery(ctx, memberID).
		Distinct().
		Pluck("businesses.id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func (s *CatalogService) GetBusinessByID(ctx context.Context, id string) (*catalogmodels.Business, error) {
	var out catalogmodels.Business
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) GetBusinessByIDForMember(ctx context.Context, memberID, id string) (*catalogmodels.Business, error) {
	var out catalogmodels.Business
	if err := s.listBusinessesForMemberAccessQuery(ctx, memberID).
		Select("businesses.*").
		Where("businesses.id = ?", id).
		First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) ListBusinessIDsForMemberAccess(ctx context.Context, memberID string) ([]string, error) {
	var ids []string
	if err := s.listBusinessesForMemberAccessQuery(ctx, memberID).
		Distinct().
		Pluck("businesses.id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func (s *CatalogService) GetBusinessByIDForMemberAccess(ctx context.Context, memberID, id string) (*catalogmodels.Business, error) {
	var out catalogmodels.Business
	if err := s.listBusinessesForMemberAccessQuery(ctx, memberID).
		Select("businesses.*").
		Where("businesses.id = ?", id).
		First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) GetBusinessByIDForMemberOwner(ctx context.Context, memberID, id string) (*catalogmodels.Business, error) {
	var out catalogmodels.Business
	if err := s.listBusinessesForMemberOwnerQuery(ctx, memberID).
		Select("businesses.*").
		Where("businesses.id = ?", id).
		First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) CreateBusinessForMember(ctx context.Context, memberID string, b *catalogmodels.Business) error {
	if strings.TrimSpace(b.Slug) == "" {
		b.Slug = b.Name
	}
	var err error
	b.Slug, err = s.ensureUniqueBusinessSlug(ctx, b.Slug, "")
	if err != nil {
		return err
	}

	membershipID, err := uuid.New()
	if err != nil {
		return err
	}
	ownerRole := "Owner"
	now := time.Now()
	membership := &catalogmodels.BusinessMember{
		ID:              membershipID,
		BusinessID:      b.ID,
		UserID:          memberID,
		IsOwner:         true,
		Role:            &ownerRole,
		Status:          "active",
		StatusChangedAt: &now,
	}

	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(b).Error; err != nil {
			return err
		}
		if err := tx.Create(membership).Error; err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertBusiness(ctx, tx, b.ID)
	})
}

func (s *CatalogService) UpdateBusiness(ctx context.Context, b *catalogmodels.Business) error {
	if strings.TrimSpace(b.Slug) == "" {
		b.Slug = b.Name
	}
	var err error
	b.Slug, err = s.ensureUniqueBusinessSlug(ctx, b.Slug, b.ID)
	if err != nil {
		return err
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(b).Error; err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertBusiness(ctx, tx, b.ID)
	})
}

func (s *CatalogService) UpdateBusinessForMember(ctx context.Context, memberID string, b *catalogmodels.Business) error {
	if _, err := s.GetBusinessByIDForMember(ctx, memberID, b.ID); err != nil {
		return err
	}
	return s.UpdateBusiness(ctx, b)
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

func (s *CatalogService) DeleteBusinessByIDForMember(ctx context.Context, memberID, id string) (int64, error) {
	if _, err := s.GetBusinessByIDForMember(ctx, memberID, id); err != nil {
		return 0, err
	}
	return s.DeleteBusinessByID(ctx, id)
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

func (s *CatalogService) ensureUniqueBusinessSlug(ctx context.Context, slug, currentID string) (string, error) {
	base := makeSlug(slug)
	if base == "" {
		return "", fmt.Errorf("business slug is required")
	}

	candidate := base
	for i := 0; i < 100; i++ {
		var count int64
		q := s.DB.WithContext(ctx).Model(&catalogmodels.Business{}).Where("slug = ?", candidate)
		if currentID != "" {
			q = q.Where("id <> ?", currentID)
		}
		if err := q.Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, i+2)
	}

	return "", fmt.Errorf("unable to generate unique business slug for %q", slug)
}
