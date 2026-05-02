package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

// =============================================================================
// AttributeGroup Methods
// =============================================================================

// CreateAttributeGroup creates a new attribute group.
func (s *CatalogService) CreateAttributeGroup(ctx context.Context, ag *catalogmodels.AttributeGroup) error {
	if strings.TrimSpace(ag.Name) == "" {
		return errors.New("attribute group name is required")
	}
	if strings.TrimSpace(ag.Slug) == "" {
		ag.Slug = makeSlug(ag.Name)
	}
	if err := s.normalizeAttributeGroupBusinessID(ctx, ag); err != nil {
		return err
	}

	if err := s.ensureUniqueAttributeGroupSlug(ctx, ag.Slug, "", ag.BusinessID); err != nil {
		return err
	}

	return s.DB.WithContext(ctx).Create(ag).Error
}

// GetAttributeGroupByID retrieves an attribute group by ID.
func (s *CatalogService) GetAttributeGroupByID(ctx context.Context, id string) (*catalogmodels.AttributeGroup, error) {
	var ag catalogmodels.AttributeGroup
	if err := s.DB.WithContext(ctx).Preload("Attributes").Where("id = ?", id).First(&ag).Error; err != nil {
		return nil, err
	}
	return &ag, nil
}

// ListAttributeGroups lists all active attribute groups.
func (s *CatalogService) ListAttributeGroups(ctx context.Context, includeInactive bool, businessID string) ([]catalogmodels.AttributeGroup, error) {
	var groups []catalogmodels.AttributeGroup
	query := s.DB.WithContext(ctx).Preload("Attributes", "is_active = ?", true).Order("display_order ASC, name ASC")
	if trimmed := strings.TrimSpace(businessID); trimmed != "" {
		query = query.Where("business_id = ?", trimmed)
	}
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}
	if err := query.Find(&groups).Error; err != nil {
		return nil, err
	}
	return groups, nil
}

// UpdateAttributeGroup updates an attribute group.
func (s *CatalogService) UpdateAttributeGroup(ctx context.Context, ag *catalogmodels.AttributeGroup) error {
	if err := s.normalizeAttributeGroupBusinessID(ctx, ag); err != nil {
		return err
	}
	if strings.TrimSpace(ag.Slug) == "" {
		ag.Slug = makeSlug(ag.Name)
	}
	if err := s.ensureUniqueAttributeGroupSlug(ctx, ag.Slug, ag.ID, ag.BusinessID); err != nil {
		return err
	}
	return s.DB.WithContext(ctx).Model(ag).Updates(ag).Error
}

// DeleteAttributeGroup soft-deletes an attribute group.
func (s *CatalogService) DeleteAttributeGroup(ctx context.Context, id string) error {
	return s.DB.WithContext(ctx).Delete(&catalogmodels.AttributeGroup{}, "id = ?", id).Error
}

// =============================================================================
// Attribute Methods
// =============================================================================

// CreateAttribute creates a new attribute within a group.
func (s *CatalogService) CreateAttribute(ctx context.Context, attr *catalogmodels.Attribute) error {
	if strings.TrimSpace(attr.Name) == "" {
		return errors.New("attribute name is required")
	}
	if strings.TrimSpace(attr.AttributeGroupID) == "" {
		return errors.New("attribute group id is required")
	}
	if strings.TrimSpace(attr.Slug) == "" {
		attr.Slug = makeSlug(attr.Name)
	}

	// Verify group exists
	var count int64
	if err := s.DB.WithContext(ctx).Model(&catalogmodels.AttributeGroup{}).Where("id = ?", attr.AttributeGroupID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("attribute group not found")
	}

	// Ensure unique slug within group
	if err := s.DB.WithContext(ctx).Model(&catalogmodels.Attribute{}).Where("attribute_group_id = ? AND slug = ?", attr.AttributeGroupID, attr.Slug).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("attribute slug '%s' already exists in this group", attr.Slug)
	}

	return s.DB.WithContext(ctx).Create(attr).Error
}

// GetAttributeByID retrieves an attribute by ID.
func (s *CatalogService) GetAttributeByID(ctx context.Context, id string) (*catalogmodels.Attribute, error) {
	var attr catalogmodels.Attribute
	if err := s.DB.WithContext(ctx).Preload("AttributeGroup").Where("id = ?", id).First(&attr).Error; err != nil {
		return nil, err
	}
	return &attr, nil
}

// ListAttributesByGroupID lists all attributes in a group.
func (s *CatalogService) ListAttributesByGroupID(ctx context.Context, groupID string, includeInactive bool) ([]catalogmodels.Attribute, error) {
	var attrs []catalogmodels.Attribute
	query := s.DB.WithContext(ctx).Where("attribute_group_id = ?", groupID).Order("display_order ASC, name ASC")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}
	if err := query.Find(&attrs).Error; err != nil {
		return nil, err
	}
	return attrs, nil
}

// UpdateAttribute updates an attribute.
func (s *CatalogService) UpdateAttribute(ctx context.Context, attr *catalogmodels.Attribute) error {
	return s.DB.WithContext(ctx).Model(attr).Updates(attr).Error
}

// DeleteAttribute soft-deletes an attribute.
func (s *CatalogService) DeleteAttribute(ctx context.Context, id string) error {
	return s.DB.WithContext(ctx).Delete(&catalogmodels.Attribute{}, "id = ?", id).Error
}

// =============================================================================
// ProductVariation Methods
// =============================================================================

// CreateProductVariation creates a new product variation.
func (s *CatalogService) CreateProductVariation(ctx context.Context, pv *catalogmodels.ProductVariation, attributeIDs []string) error {
	if strings.TrimSpace(pv.ProductID) == "" {
		return errors.New("product id is required")
	}
	if strings.TrimSpace(pv.SKU) == "" {
		return errors.New("sku is required")
	}
	if pv.Price < 0 {
		return errors.New("price cannot be negative")
	}

	// Verify product exists
	var count int64
	if err := s.DB.WithContext(ctx).Model(&catalogmodels.Product{}).Where("id = ?", pv.ProductID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("product not found")
	}

	// Check SKU is unique
	if err := s.DB.WithContext(ctx).Model(&catalogmodels.ProductVariation{}).Where("sku = ?", pv.SKU).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("sku '%s' already exists", pv.SKU)
	}

	// Create variation with attributes in transaction
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(pv).Error; err != nil {
			return err
		}
		if len(attributeIDs) > 0 {
			if err := s.syncVariationAttributesTx(ctx, tx, pv.ID, attributeIDs); err != nil {
				return err
			}
		}
		return nil
	})
}

// GetProductVariationByID retrieves a variation by ID with assets and attributes.
func (s *CatalogService) GetProductVariationByID(ctx context.Context, id string) (*catalogmodels.ProductVariation, error) {
	var pv catalogmodels.ProductVariation
	if err := s.DB.WithContext(ctx).
		Preload("Attributes").
		Preload("Attributes.AttributeGroup").
		Preload("Assets").
		Where("id = ?", id).
		First(&pv).Error; err != nil {
		return nil, err
	}
	return &pv, nil
}

// GetProductVariationBySKU retrieves a variation by SKU.
func (s *CatalogService) GetProductVariationBySKU(ctx context.Context, sku string) (*catalogmodels.ProductVariation, error) {
	var pv catalogmodels.ProductVariation
	if err := s.DB.WithContext(ctx).
		Preload("Attributes").
		Preload("Attributes.AttributeGroup").
		Preload("Assets").
		Where("sku = ?", sku).
		First(&pv).Error; err != nil {
		return nil, err
	}
	return &pv, nil
}

// ListProductVariationsByProductID lists all variations for a product.
func (s *CatalogService) ListProductVariationsByProductID(ctx context.Context, productID string) ([]catalogmodels.ProductVariation, error) {
	var variations []catalogmodels.ProductVariation
	if err := s.DB.WithContext(ctx).
		Preload("Attributes").
		Preload("Attributes.AttributeGroup").
		Preload("Assets").
		Where("product_id = ? AND is_active = ?", productID, true).
		Order("is_default DESC, created_at ASC").
		Find(&variations).Error; err != nil {
		return nil, err
	}
	return variations, nil
}

// UpdateProductVariation updates a variation.
func (s *CatalogService) UpdateProductVariation(ctx context.Context, pv *catalogmodels.ProductVariation, attributeIDs []string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(pv).Updates(pv).Error; err != nil {
			return err
		}
		if len(attributeIDs) > 0 {
			if err := s.syncVariationAttributesTx(ctx, tx, pv.ID, attributeIDs); err != nil {
				return err
			}
		}
		return nil
	})
}

// DeleteProductVariation soft-deletes a variation.
func (s *CatalogService) DeleteProductVariation(ctx context.Context, id string) error {
	return s.DB.WithContext(ctx).Delete(&catalogmodels.ProductVariation{}, "id = ?", id).Error
}

// UpdateVariationAssets replaces asset mappings for a variation.
func (s *CatalogService) UpdateVariationAssets(ctx context.Context, variationID, productID string, assetIDs []string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return s.syncVariationAssetsTx(ctx, tx, variationID, productID, assetIDs)
	})
}

// GetVariationByAttributes finds a variation matching the given attribute IDs.
func (s *CatalogService) GetVariationByAttributes(ctx context.Context, productID string, attributeIDs []string) (*catalogmodels.ProductVariation, error) {
	if len(attributeIDs) == 0 {
		return nil, errors.New("attribute ids cannot be empty")
	}

	var pv catalogmodels.ProductVariation
	// Query variations for product that have all requested attributes.
	// This uses a subquery to find variations with exact attribute match.
	subquery := s.DB.WithContext(ctx).
		Distinct("product_variation_id").
		Model(&catalogmodels.VariationAttribute{}).
		Where("attribute_id IN ?", attributeIDs).
		Group("product_variation_id").
		Having("COUNT(DISTINCT attribute_id) = ?", len(attributeIDs))

	if err := s.DB.WithContext(ctx).
		Preload("Attributes").
		Preload("Attributes.AttributeGroup").
		Preload("Assets").
		Where("product_id = ? AND is_active = ? AND id IN (?)", productID, true, subquery).
		First(&pv).Error; err != nil {
		return nil, err
	}
	return &pv, nil
}

func (s *CatalogService) normalizeAttributeGroupBusinessID(ctx context.Context, ag *catalogmodels.AttributeGroup) error {
	if ag.BusinessID == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*ag.BusinessID)
	if trimmed == "" {
		ag.BusinessID = nil
		return nil
	}
	if _, err := s.GetBusinessByID(ctx, trimmed); err != nil {
		return err
	}
	ag.BusinessID = &trimmed
	return nil
}

func (s *CatalogService) ensureUniqueAttributeGroupSlug(ctx context.Context, slug, currentID string, businessID *string) error {
	base := makeSlug(slug)
	candidate := base
	q := s.DB.WithContext(ctx).Model(&catalogmodels.AttributeGroup{}).Where("slug = ?", candidate)
	if currentID != "" {
		q = q.Where("id <> ?", currentID)
	}
	trimmedBusinessID := ""
	if businessID != nil {
		trimmedBusinessID = strings.TrimSpace(*businessID)
	}
	if trimmedBusinessID == "" {
		q = q.Where("business_id IS NULL")
	} else {
		q = q.Where("business_id = ?", trimmedBusinessID)
	}

	var count int64
	if err := q.Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		if trimmedBusinessID == "" {
			return fmt.Errorf("attribute group slug '%s' already exists", candidate)
		}
		return fmt.Errorf("attribute group slug '%s' already exists in this business", candidate)
	}
	return nil
}

// =============================================================================
// Helper Methods (Transaction-scoped)
// =============================================================================

// syncVariationAttributesTx syncs variation attributes within a transaction.
func (s *CatalogService) syncVariationAttributesTx(ctx context.Context, tx *gorm.DB, variationID string, attributeIDs []string) error {
	// Delete existing associations
	if err := tx.Where("product_variation_id = ?", variationID).Delete(&catalogmodels.VariationAttribute{}).Error; err != nil {
		return err
	}

	// Create new associations
	for _, attrID := range attributeIDs {
		va := &catalogmodels.VariationAttribute{
			ID:                 uuid.NewString(),
			ProductVariationID: variationID,
			AttributeID:        attrID,
		}
		if err := tx.Create(va).Error; err != nil {
			return err
		}
	}
	return nil
}

// syncVariationAssetsTx syncs variation assets within a transaction.
func (s *CatalogService) syncVariationAssetsTx(ctx context.Context, tx *gorm.DB, variationID, productID string, assetIDs []string) error {
	// Clear existing mappings first.
	if err := tx.Where("product_variation_id = ?", variationID).Delete(&catalogmodels.VariationAsset{}).Error; err != nil {
		return err
	}

	if len(assetIDs) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(assetIDs))
	for i, assetID := range assetIDs {
		assetID = strings.TrimSpace(assetID)
		if assetID == "" {
			continue
		}
		if _, ok := seen[assetID]; ok {
			continue
		}
		seen[assetID] = struct{}{}

		// Ensure asset belongs to the same product as variation.
		var count int64
		if err := tx.WithContext(ctx).
			Model(&catalogmodels.ProductAsset{}).
			Where("id = ? AND product_id = ?", assetID, productID).
			Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return fmt.Errorf("asset '%s' not found for this product", assetID)
		}

		isMain := i == 0
		row := &catalogmodels.VariationAsset{
			ID:                 uuid.NewString(),
			ProductVariationID: variationID,
			AssetID:            assetID,
			IsMain:             isMain,
			DisplayOrder:       i,
		}
		if err := tx.WithContext(ctx).Create(row).Error; err != nil {
			return err
		}
	}

	return nil
}
