package services

import (
	"bytes"
	"context"
	"errors"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

// ListDigitalFiles returns all active digital files for a product.
func (s *CatalogService) ListDigitalFiles(ctx context.Context, productID string) ([]catalogmodels.ProductDigitalFile, error) {
	var files []catalogmodels.ProductDigitalFile
	q := s.DB.WithContext(ctx).Where("product_id = ? AND deleted_at IS NULL", productID).
		Order("sort_order ASC, created_at ASC")
	if err := q.Find(&files).Error; err != nil {
		return nil, err
	}
	return files, nil
}

// GetDigitalFileByID returns a single digital file record.
func (s *CatalogService) GetDigitalFileByID(ctx context.Context, id string) (*catalogmodels.ProductDigitalFile, error) {
	var f catalogmodels.ProductDigitalFile
	err := s.DB.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&f).Error
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// CreateDigitalFile creates a new digital file record (file already stored in storage).
func (s *CatalogService) CreateDigitalFile(ctx context.Context, f *catalogmodels.ProductDigitalFile) error {
	if f.ID == "" {
		id, err := uuid.New()
		if err != nil {
			return err
		}
		f.ID = id
	}
	return s.DB.WithContext(ctx).Create(f).Error
}

// UpdateDigitalFile patches a digital file record.
func (s *CatalogService) UpdateDigitalFile(ctx context.Context, f *catalogmodels.ProductDigitalFile) error {
	return s.DB.WithContext(ctx).Save(f).Error
}

// DeleteDigitalFile soft-deletes a digital file record.
func (s *CatalogService) DeleteDigitalFile(ctx context.Context, id string) error {
	res := s.DB.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", id).
		Delete(&catalogmodels.ProductDigitalFile{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("digital file not found")
	}
	return nil
}

// UploadDigitalFile stores the binary file and creates the metadata record.
func (s *CatalogService) UploadDigitalFile(ctx context.Context, productID string, fileName string, mimeType string, size int64, data []byte, downloadLimit int, sortOrder int) (*catalogmodels.ProductDigitalFile, error) {
	id, err := uuid.New()
	if err != nil {
		return nil, err
	}

	// Store under products/digital/<product_id>/<uuid>/<filename>
	storagePath := "products/digital/" + productID + "/" + id + "/" + fileName
	if err := s.Store.Put(ctx, storagePath, bytes.NewReader(data)); err != nil {
		return nil, err
	}

	f := &catalogmodels.ProductDigitalFile{
		ID:            id,
		ProductID:     productID,
		FilePath:      storagePath,
		FileName:      fileName,
		MimeType:      mimeType,
		FileSize:      size,
		DownloadLimit: downloadLimit,
		IsActive:      true,
		SortOrder:     sortOrder,
	}
	if err := s.DB.WithContext(ctx).Create(f).Error; err != nil {
		return nil, err
	}
	return f, nil
}

// GetDigitalFilesByProductIDs returns digital files for multiple product IDs.
// Used by order service to know which digital items need entitlement.
func (s *CatalogService) GetDigitalFilesByProductIDs(ctx context.Context, productIDs []string) ([]catalogmodels.ProductDigitalFile, error) {
	if len(productIDs) == 0 {
		return nil, nil
	}
	var files []catalogmodels.ProductDigitalFile
	if err := s.DB.WithContext(ctx).
		Where("product_id IN ? AND is_active = TRUE AND deleted_at IS NULL", productIDs).
		Order("product_id, sort_order ASC").
		Find(&files).Error; err != nil {
		return nil, err
	}
	return files, nil
}

// CanAccessDigitalFile checks if a customer has a paid order containing the product.
// Returns the file if access is granted.
func (s *CatalogService) CanAccessDigitalFile(ctx context.Context, fileID string, customerID string) (*catalogmodels.ProductDigitalFile, error) {
	f, err := s.GetDigitalFileByID(ctx, fileID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("file not found")
		}
		return nil, err
	}
	if !f.IsActive {
		return nil, errors.New("file is not available")
	}

	// Check: customer must have a paid order containing this product
	var count int64
	err = s.DB.WithContext(ctx).Raw(`
		SELECT COUNT(*)
		FROM orders o
		JOIN order_items oi ON oi.order_id = o.id
		WHERE o.customer_id = ?
		  AND oi.product_id = ?
		  AND o.payment_status = 'paid'
	`, customerID, f.ProductID).Scan(&count).Error
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, errors.New("access denied: no paid order found for this product")
	}
	return f, nil
}
