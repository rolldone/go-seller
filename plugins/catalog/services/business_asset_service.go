package services

import (
	"context"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

func (s *CatalogService) CreateBusinessAsset(ctx context.Context, a *catalogmodels.BusinessAsset) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if a.IsMain {
			q := tx.Model(&catalogmodels.BusinessAsset{})
			// scope unset to same business and same usage_tag (or empty/null)
			if a.UsageTag != "" {
				if err := q.Where("business_id = ? AND usage_tag = ? AND id <> ?", a.BusinessID, a.UsageTag, a.ID).
					Update("is_main", false).Error; err != nil {
					return err
				}
			} else {
				if err := q.Where("business_id = ? AND (usage_tag = '' OR usage_tag IS NULL) AND id <> ?", a.BusinessID, a.ID).
					Update("is_main", false).Error; err != nil {
					return err
				}
			}
		}
		if err := tx.Create(a).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *CatalogService) ListBusinessAssets(ctx context.Context, businessID, folderID string, page, limit int) ([]catalogmodels.BusinessAsset, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	q := s.DB.WithContext(ctx).Model(&catalogmodels.BusinessAsset{})
	if businessID != "" {
		q = q.Where("business_id = ?", businessID)
	}

	folderID = strings.TrimSpace(folderID)
	if folderID != "" {
		if folderID == "root" {
			q = q.Where("folder_id IS NULL")
		} else {
			q = q.Where("folder_id = ?", folderID)
		}
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	var rows []catalogmodels.BusinessAsset
	if err := q.Order("display_order asc, created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) MoveBusinessAssetToFolder(ctx context.Context, businessID, assetID string, folderID *string) error {
	return s.DB.WithContext(ctx).
		Model(&catalogmodels.BusinessAsset{}).
		Where("id = ? AND business_id = ?", assetID, businessID).
		Update("folder_id", folderID).Error
}

func (s *CatalogService) CopyBusinessAsset(ctx context.Context, businessID, assetID string, folderID *string) (*catalogmodels.BusinessAsset, error) {
	original, err := s.GetBusinessAssetByID(ctx, assetID)
	if err != nil {
		return nil, err
	}
	if original.BusinessID != businessID {
		return nil, gorm.ErrRecordNotFound
	}

	newID, err := uuid.New()
	if err != nil {
		return nil, fmt.Errorf("failed to generate id: %w", err)
	}

	copyItem := &catalogmodels.BusinessAsset{
		ID:           newID,
		BusinessID:   original.BusinessID,
		FolderID:     folderID,
		FilePath:     original.FilePath,
		FileType:     original.FileType,
		MimeType:     original.MimeType,
		FileSize:     original.FileSize,
		OriginalName: original.OriginalName,
		PublicURL:    original.PublicURL,
		IsMain:       false,
		UsageTag:     original.UsageTag,
		DisplayOrder: original.DisplayOrder,
	}

	if err := s.CreateBusinessAsset(ctx, copyItem); err != nil {
		return nil, err
	}
	return copyItem, nil
}

func (s *CatalogService) GetBusinessAssetByID(ctx context.Context, id string) (*catalogmodels.BusinessAsset, error) {
	var out catalogmodels.BusinessAsset
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) UpdateBusinessAsset(ctx context.Context, a *catalogmodels.BusinessAsset) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if a.IsMain {
			q := tx.Model(&catalogmodels.BusinessAsset{})
			// scope unset to same business and same usage_tag (or empty/null)
			if a.UsageTag != "" {
				if err := q.Where("business_id = ? AND usage_tag = ? AND id <> ?", a.BusinessID, a.UsageTag, a.ID).
					Update("is_main", false).Error; err != nil {
					return err
				}
			} else {
				if err := q.Where("business_id = ? AND (usage_tag = '' OR usage_tag IS NULL) AND id <> ?", a.BusinessID, a.ID).
					Update("is_main", false).Error; err != nil {
					return err
				}
			}
		}
		if err := tx.Save(a).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *CatalogService) DeleteBusinessAssetByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&catalogmodels.BusinessAsset{})
	return res.RowsAffected, res.Error
}

func (s *CatalogService) UploadBusinessAsset(ctx context.Context, businessID string, folderID *string, fileHeader *multipart.FileHeader, fileType string, isMain bool, displayOrder int, usageTag string) (*catalogmodels.BusinessAsset, error) {
	assetID, err := uuid.New()
	if err != nil {
		return nil, fmt.Errorf("failed to generate asset ID: %w", err)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer file.Close()

	ext := filepath.Ext(fileHeader.Filename)
	if ext == "" {
		ext = ".bin"
	}

	storageKey := fmt.Sprintf("businesses/%s/%s%s", businessID, assetID, ext)

	if err := s.Store.Put(ctx, storageKey, file); err != nil {
		return nil, fmt.Errorf("failed to upload file to storage: %w", err)
	}

	publicURL := "/assets/" + storageKey

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = detectMimeType(fileHeader.Filename)
	}

	if fileType == "" {
		fileType = detectFileType(mimeType)
	}

	asset := &catalogmodels.BusinessAsset{
		ID:           assetID,
		BusinessID:   businessID,
		FolderID:     folderID,
		FilePath:     storageKey,
		FileType:     fileType,
		MimeType:     mimeType,
		FileSize:     fileHeader.Size,
		OriginalName: fileHeader.Filename,
		PublicURL:    publicURL,
		IsMain:       isMain,
		DisplayOrder: displayOrder,
		UsageTag:     usageTag,
	}

	if err := s.CreateBusinessAsset(ctx, asset); err != nil {
		_ = s.Store.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to save asset metadata: %w", err)
	}

	return asset, nil
}

func (s *CatalogService) DeleteBusinessAssetWithFile(ctx context.Context, id string) error {
	asset, err := s.GetBusinessAssetByID(ctx, id)
	if err != nil {
		return err
	}

	if asset.FilePath != "" {
		if err := s.Store.Delete(ctx, asset.FilePath); err != nil {
			// ignore storage delete error
		}
	}

	_, err = s.DeleteBusinessAssetByID(ctx, id)
	return err
}

// CreateBusinessAssetDerivative saves derivative metadata to DB.
func (s *CatalogService) CreateBusinessAssetDerivative(ctx context.Context, d *catalogmodels.BusinessAssetDerivative) error {
	return s.DB.WithContext(ctx).Create(d).Error
}

// ListBusinessAssetDerivatives lists derivatives for an asset.
func (s *CatalogService) ListBusinessAssetDerivatives(ctx context.Context, assetID string) ([]catalogmodels.BusinessAssetDerivative, error) {
	var out []catalogmodels.BusinessAssetDerivative
	if err := s.DB.WithContext(ctx).Where("asset_id = ?", assetID).Order("created_at asc").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// FinalizeBusinessAsset moves the file from ingest path to public path, validates it, and saves DB record.
func (s *CatalogService) FinalizeBusinessAsset(ctx context.Context, businessID, assetID, ingestPath, mimeType string, width, height int, size int64, originalName string, isMain bool, displayOrder int, usageTag string, folderID *string) (*catalogmodels.BusinessAsset, error) {
	// Validate image (allow common image formats). max size nil (use size param) but also check via ValidateImage
	maxSize := int64(0)
	// Try validate; if it's an image we validate dimensions
	vres, err := s.ValidateImage(ctx, ingestPath, maxSize, nil)
	if err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}
	if !vres.Valid {
		return nil, fmt.Errorf("validation failed: %s", vres.Error)
	}

	// Determine extension from ingestPath
	ext := filepath.Ext(ingestPath)
	publicKey := fmt.Sprintf("businesses/%s/%s%s", businessID, assetID, ext)

	// Move: read from ingest and put to public
	rc, err := s.Store.Get(ctx, ingestPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open ingest file: %w", err)
	}
	defer rc.Close()

	if err := s.Store.Put(ctx, publicKey, rc); err != nil {
		return nil, fmt.Errorf("failed to copy file to public: %w", err)
	}

	publicURL := "/assets/" + publicKey

	// Create DB record (transactional logic for is_main)
	asset := &catalogmodels.BusinessAsset{
		ID:           assetID,
		BusinessID:   businessID,
		FolderID:     folderID,
		FilePath:     publicKey,
		FileType:     detectFileType(mimeType),
		MimeType:     mimeType,
		FileSize:     size,
		OriginalName: originalName,
		PublicURL:    publicURL,
		IsMain:       isMain,
		DisplayOrder: displayOrder,
		UsageTag:     usageTag,
	}

	if err := s.CreateBusinessAsset(ctx, asset); err != nil {
		// cleanup public file
		_ = s.Store.Delete(ctx, publicKey)
		return nil, fmt.Errorf("failed to save asset metadata: %w", err)
	}

	// Cleanup ingest file
	_ = s.Store.Delete(ctx, ingestPath)

	return asset, nil
}
