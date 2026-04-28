package services

import (
	"context"
	"strings"
	"time"

	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

// DiscountListFilter describes optional filters for querying discounts.
type DiscountListFilter struct {
	Query      string
	ProductID  string
	CustomerID string
	BusinessID string
	IsActive   *bool
	Page       int
	Limit      int
}

// CreateDiscount stores a new discount record.
func (s *CatalogService) CreateDiscount(ctx context.Context, discount *catalogmodels.Discount) error {
	normalized := NormalizeDiscountProductIDs(discount.ProductIDs)
	discount.ProductIDs = normalized

	if err := s.DB.WithContext(ctx).Omit("product_id").Create(discount).Error; err != nil {
		return err
	}
	return s.SetDiscountProductIDs(ctx, discount.ID, normalized)
}

// ListDiscounts returns paginated discounts matching the supplied filters.
func (s *CatalogService) ListDiscounts(ctx context.Context, f DiscountListFilter) ([]catalogmodels.Discount, int64, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Limit > 100 {
		f.Limit = 100
	}

	db := s.DB.WithContext(ctx).Model(&catalogmodels.Discount{})
	if search := strings.TrimSpace(f.Query); search != "" {
		like := "%" + search + "%"
		db = db.Where("name ILIKE ?", like)
	}
	if f.ProductID != "" {
		db = db.Where("EXISTS (SELECT 1 FROM discount_products dp WHERE dp.discount_id = discounts.id AND dp.product_id = ?)", f.ProductID)
	}
	if f.CustomerID != "" {
		db = db.Where("customer_id = ?", f.CustomerID)
	}
	if businessID := strings.TrimSpace(f.BusinessID); businessID != "" {
		db = db.Where("business_id = ?", businessID)
	}
	if f.IsActive != nil {
		db = db.Where("is_active = ?", *f.IsActive)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []catalogmodels.Discount
	if err := db.Order("priority DESC").Order("created_at DESC").Offset((f.Page - 1) * f.Limit).Limit(f.Limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	if len(items) == 0 {
		return items, total, nil
	}
	ids := make([]string, len(items))
	for i := range items {
		ids[i] = items[i].ID
	}
	productMap, err := s.buildDiscountProductMap(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	for i := range items {
		items[i].ProductIDs = productMap[items[i].ID]
	}
	return items, total, nil
}

// GetDiscountByID fetches a discount by its ID.
func (s *CatalogService) GetDiscountByID(ctx context.Context, id string) (*catalogmodels.Discount, error) {
	var discount catalogmodels.Discount
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&discount).Error; err != nil {
		return nil, err
	}
	productMap, err := s.buildDiscountProductMap(ctx, []string{discount.ID})
	if err != nil {
		return nil, err
	}
	discount.ProductIDs = productMap[discount.ID]
	return &discount, nil
}

// UpdateDiscountByID applies the given updates to a discount record.
func (s *CatalogService) UpdateDiscountByID(ctx context.Context, id string, updates map[string]interface{}) (int64, error) {
	if len(updates) == 0 {
		return 0, nil
	}
	updates["updated_at"] = time.Now()
	res := s.DB.WithContext(ctx).Model(&catalogmodels.Discount{}).Where("id = ?", id).Updates(updates)
	return res.RowsAffected, res.Error
}

// DeleteDiscountByID soft-deletes a discount record.
func (s *CatalogService) DeleteDiscountByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&catalogmodels.Discount{})
	return res.RowsAffected, res.Error
}

func (s *CatalogService) SetDiscountProductIDs(ctx context.Context, discountID string, productIDs []string) error {
	normalized := NormalizeDiscountProductIDs(productIDs)
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("discount_id = ?", discountID).Delete(&catalogmodels.DiscountProduct{}).Error; err != nil {
			return err
		}
		if len(normalized) == 0 {
			return nil
		}
		relations := make([]catalogmodels.DiscountProduct, 0, len(normalized))
		for _, productID := range normalized {
			relations = append(relations, catalogmodels.DiscountProduct{
				DiscountID: discountID,
				ProductID:  productID,
			})
		}
		return tx.Create(&relations).Error
	})
}

func (s *CatalogService) buildDiscountProductMap(ctx context.Context, discountIDs []string) (map[string][]string, error) {
	result := make(map[string][]string)
	if len(discountIDs) == 0 {
		return result, nil
	}
	var relations []catalogmodels.DiscountProduct
	if err := s.DB.WithContext(ctx).
		Select("discount_id, product_id").
		Where("discount_id IN ?", discountIDs).
		Order("discount_id, product_id").
		Find(&relations).Error; err != nil {
		return nil, err
	}
	for _, rel := range relations {
		result[rel.DiscountID] = append(result[rel.DiscountID], rel.ProductID)
	}
	return result, nil
}

// GetActiveDiscountsForProductIDs returns active discounts grouped by product ID.
func (s *CatalogService) GetActiveDiscountsForProductIDs(ctx context.Context, productIDs []string, businessID string) (map[string][]catalogmodels.Discount, error) {
	result := make(map[string][]catalogmodels.Discount)
	if len(productIDs) == 0 {
		return result, nil
	}

	now := time.Now().UTC()

	// First get active discounts in time window
	q := s.DB.WithContext(ctx).
		Where("is_active = ? AND start_at <= ? AND (end_at IS NULL OR end_at >= ?)", true, now, now)
	if businessID = strings.TrimSpace(businessID); businessID != "" {
		q = q.Where("business_id = ?", businessID)
	}
	var activeDiscounts []catalogmodels.Discount
	if err := q.
		Order("priority DESC, created_at DESC").
		Find(&activeDiscounts).Error; err != nil {
		return nil, err
	}
	if len(activeDiscounts) == 0 {
		return result, nil
	}

	// build map of discountID -> Discount
	discountMap := make(map[string]catalogmodels.Discount, len(activeDiscounts))
	discountIDs := make([]string, 0, len(activeDiscounts))
	for _, d := range activeDiscounts {
		discountMap[d.ID] = d
		discountIDs = append(discountIDs, d.ID)
	}

	// find relations for these discounts and requested products
	var relations []catalogmodels.DiscountProduct
	if err := s.DB.WithContext(ctx).
		Where("discount_id IN ? AND product_id IN ?", discountIDs, productIDs).
		Order("discount_id, product_id").
		Find(&relations).Error; err != nil {
		return nil, err
	}

	for _, rel := range relations {
		if d, ok := discountMap[rel.DiscountID]; ok {
			result[rel.ProductID] = append(result[rel.ProductID], d)
		}
	}

	return result, nil
}

func NormalizeDiscountProductIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	cleaned := make([]string, 0, len(ids))
	for _, id := range ids {
		trimmed := strings.TrimSpace(id)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		cleaned = append(cleaned, trimmed)
	}
	return cleaned
}
