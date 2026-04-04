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

func (s *CatalogService) CreateProductAsset(ctx context.Context, a *catalogmodels.ProductAsset) error {
	// If the new asset is marked as main, unset other assets' is_main for the same product in the same transaction.
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if a.IsMain {
			q := tx.Model(&catalogmodels.ProductAsset{})
			// scope unset to same product and same usage_tag (or empty/null)
			if a.UsageTag != "" {
				if err := q.Where("product_id = ? AND usage_tag = ? AND id <> ?", a.ProductID, a.UsageTag, a.ID).
					Update("is_main", false).Error; err != nil {
					return err
				}
			} else {
				if err := q.Where("product_id = ? AND (usage_tag = '' OR usage_tag IS NULL) AND id <> ?", a.ProductID, a.ID).
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

func (s *CatalogService) ListProductAssets(ctx context.Context, productID string, page, limit int) ([]catalogmodels.ProductAsset, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	q := s.DB.WithContext(ctx).Model(&catalogmodels.ProductAsset{})
	if productID != "" {
		q = q.Where("product_id = ?", productID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	var rows []catalogmodels.ProductAsset
	if err := q.Order("display_order asc, created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *CatalogService) GetProductAssetByID(ctx context.Context, id string) (*catalogmodels.ProductAsset, error) {
	var out catalogmodels.ProductAsset
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *CatalogService) UpdateProductAsset(ctx context.Context, a *catalogmodels.ProductAsset) error {
	// When updating an asset and it's being set as main, ensure other assets for the same product are unset atomically.
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if a.IsMain {
			q := tx.Model(&catalogmodels.ProductAsset{})
			// scope unset to same product and same usage_tag (or empty/null)
			if a.UsageTag != "" {
				if err := q.Where("product_id = ? AND usage_tag = ? AND id <> ?", a.ProductID, a.UsageTag, a.ID).
					Update("is_main", false).Error; err != nil {
					return err
				}
			} else {
				if err := q.Where("product_id = ? AND (usage_tag = '' OR usage_tag IS NULL) AND id <> ?", a.ProductID, a.ID).
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

func (s *CatalogService) DeleteProductAssetByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&catalogmodels.ProductAsset{})
	return res.RowsAffected, res.Error
}

// UploadProductAsset meng-upload file ke storage dan menyimpan metadata ke DB
func (s *CatalogService) UploadProductAsset(ctx context.Context, productID string, fileHeader *multipart.FileHeader, fileType string, isMain bool, displayOrder int, usageTag string) (*catalogmodels.ProductAsset, error) {
	// Generate ID untuk asset
	assetID, err := uuid.New()
	if err != nil {
		return nil, fmt.Errorf("failed to generate asset ID: %w", err)
	}

	// Buka file dari multipart
	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer file.Close()

	// Dapatkan extension dari original filename
	ext := filepath.Ext(fileHeader.Filename)
	if ext == "" {
		ext = ".bin" // fallback
	}

	// Generate storage key: products/<productID>/<assetID><ext>
	storageKey := fmt.Sprintf("products/%s/%s%s", productID, assetID, ext)

	// Upload file ke storage
	if err := s.Store.Put(ctx, storageKey, file); err != nil {
		return nil, fmt.Errorf("failed to upload file to storage: %w", err)
	}

	// Simpan hanya path relatif untuk public_url agar tidak bergantung pada domain
	// Use the static serving prefix `/assets` so frontend can concatenate base URL at runtime
	publicURL := "/assets/" + storageKey

	// Deteksi mime type
	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = detectMimeType(fileHeader.Filename)
	}

	// Auto-detect file type jika tidak disediakan
	if fileType == "" {
		fileType = detectFileType(mimeType)
	}

	// Create asset record
	asset := &catalogmodels.ProductAsset{
		ID:           assetID,
		ProductID:    productID,
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

	// Save to DB
	if err := s.CreateProductAsset(ctx, asset); err != nil {
		// Cleanup uploaded file jika gagal simpan ke DB
		_ = s.Store.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to save asset metadata: %w", err)
	}

	return asset, nil
}

// DeleteProductAssetWithFile menghapus asset dari DB dan file dari storage
func (s *CatalogService) DeleteProductAssetWithFile(ctx context.Context, id string) error {
	// Get asset metadata
	asset, err := s.GetProductAssetByID(ctx, id)
	if err != nil {
		return err
	}

	// Delete dari storage
	if asset.FilePath != "" {
		if err := s.Store.Delete(ctx, asset.FilePath); err != nil {
			// Log error tapi tetap lanjut hapus dari DB
			// (file mungkin sudah terhapus manual atau tidak ada)
		}
	}

	// Delete dari DB
	_, err = s.DeleteProductAssetByID(ctx, id)
	return err
}

// GetProductAssetsForProductIDs returns product assets grouped by product ID.
// If usageTag is non-empty, it filters assets by that usage tag (e.g., 'gallery').
func (s *CatalogService) GetProductAssetsForProductIDs(ctx context.Context, productIDs []string, usageTag string) (map[string][]catalogmodels.ProductAsset, error) {
	result := make(map[string][]catalogmodels.ProductAsset)
	if len(productIDs) == 0 {
		return result, nil
	}

	q := s.DB.WithContext(ctx).Model(&catalogmodels.ProductAsset{}).Where("product_id IN ?", productIDs)
	if strings.TrimSpace(usageTag) != "" {
		q = q.Where("usage_tag = ?", usageTag)
	}

	// prefer main assets first, then explicit display_order, then older created_at
	var rows []catalogmodels.ProductAsset
	if err := q.Order("is_main DESC, display_order ASC, created_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}

	for _, r := range rows {
		result[r.ProductID] = append(result[r.ProductID], r)
	}
	return result, nil
}

// detectMimeType mendeteksi mime type dari filename extension
func detectMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}

// detectFileType mendeteksi file type (image/video/doc) dari mime type
func detectFileType(mimeType string) string {
	if strings.HasPrefix(mimeType, "image/") {
		return "image"
	}
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	return "doc"
}
