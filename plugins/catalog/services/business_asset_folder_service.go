package services

import (
	"context"
	"fmt"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

func slugifyFolderName(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = strings.ReplaceAll(s, "_", "-")
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return -1
	}, s)
	s = strings.Trim(s, "-")
	if s == "" {
		s = "folder"
	}
	return s
}

func (s *CatalogService) ListBusinessAssetFolders(ctx context.Context, businessID string) ([]catalogmodels.BusinessAssetFolder, error) {
	var rows []catalogmodels.BusinessAssetFolder
	q := s.DB.WithContext(ctx).Model(&catalogmodels.BusinessAssetFolder{}).
		Where("business_id = ?", businessID).
		Order("path asc, created_at asc")
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *CatalogService) CreateBusinessAssetFolder(ctx context.Context, businessID, name string, parentID *string) (*catalogmodels.BusinessAssetFolder, error) {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return nil, fmt.Errorf("folder name is required")
	}

	slug := slugifyFolderName(trimmedName)
	path := slug
	if parentID != nil && strings.TrimSpace(*parentID) != "" {
		var parent catalogmodels.BusinessAssetFolder
		if err := s.DB.WithContext(ctx).
			Where("id = ? AND business_id = ?", strings.TrimSpace(*parentID), businessID).
			First(&parent).Error; err != nil {
			return nil, err
		}
		path = parent.Path + "/" + slug
	}

	id, err := uuid.New()
	if err != nil {
		return nil, fmt.Errorf("failed to generate folder id: %w", err)
	}

	item := &catalogmodels.BusinessAssetFolder{
		ID:         id,
		BusinessID: businessID,
		ParentID:   parentID,
		Name:       trimmedName,
		Slug:       slug,
		Path:       path,
	}

	if err := s.DB.WithContext(ctx).Create(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *CatalogService) UpdateBusinessAssetFolder(ctx context.Context, businessID, folderID, name string) (*catalogmodels.BusinessAssetFolder, error) {
	var row catalogmodels.BusinessAssetFolder
	if err := s.DB.WithContext(ctx).Where("id = ? AND business_id = ?", folderID, businessID).First(&row).Error; err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(name)
	if trimmed != "" {
		row.Name = trimmed
		row.Slug = slugifyFolderName(trimmed)
	}

	if err := s.DB.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *CatalogService) DeleteBusinessAssetFolder(ctx context.Context, businessID, folderID string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Move all assets in this folder to root before deletion.
		if err := tx.Model(&catalogmodels.BusinessAsset{}).
			Where("business_id = ? AND folder_id = ?", businessID, folderID).
			Update("folder_id", nil).Error; err != nil {
			return err
		}

		// Move child folders to root to avoid recursive path rewrite for now.
		if err := tx.Model(&catalogmodels.BusinessAssetFolder{}).
			Where("business_id = ? AND parent_id = ?", businessID, folderID).
			Updates(map[string]interface{}{"parent_id": nil, "path": gorm.Expr("slug")}).Error; err != nil {
			return err
		}

		if err := tx.Where("id = ? AND business_id = ?", folderID, businessID).
			Delete(&catalogmodels.BusinessAssetFolder{}).Error; err != nil {
			return err
		}
		return nil
	})
}
