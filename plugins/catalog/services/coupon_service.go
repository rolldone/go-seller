package services

import (
	"context"
	"strings"
	"time"

	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

// CouponListFilter describes optional filters for querying coupons.
type CouponListFilter struct {
	Query      string
	ProductID  string
	CustomerID string
	BusinessID string
	IsActive   *bool
	Page       int
	Limit      int
}

// CreateCoupon stores a new coupon record.
func (s *CatalogService) CreateCoupon(ctx context.Context, coupon *catalogmodels.Coupon) error {
	normalized := NormalizeCouponProductIDs(coupon.ProductIDs)
	coupon.ProductIDs = normalized
	if err := s.DB.WithContext(ctx).Create(coupon).Error; err != nil {
		return err
	}
	return s.SetCouponProductIDs(ctx, coupon.ID, normalized)
}

// ListCoupons returns paginated coupons matching the supplied filters.
func (s *CatalogService) ListCoupons(ctx context.Context, f CouponListFilter) ([]catalogmodels.Coupon, int64, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Limit > 100 {
		f.Limit = 100
	}

	db := s.DB.WithContext(ctx).Model(&catalogmodels.Coupon{})
	if search := strings.TrimSpace(f.Query); search != "" {
		like := "%" + search + "%"
		db = db.Where("code ILIKE ? OR name ILIKE ?", like, like)
	}
	if f.ProductID != "" {
		db = db.Where("EXISTS (SELECT 1 FROM coupon_products WHERE coupon_products.coupon_id = coupons.id AND coupon_products.product_id = ?)", f.ProductID)
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

	var items []catalogmodels.Coupon
	if err := db.Order("created_at DESC").Offset((f.Page - 1) * f.Limit).Limit(f.Limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	if len(items) == 0 {
		return items, total, nil
	}
	couponIDs := make([]string, len(items))
	for i := range items {
		couponIDs[i] = items[i].ID
	}
	productMap, err := s.buildCouponProductMap(ctx, couponIDs)
	if err != nil {
		return nil, 0, err
	}
	for i := range items {
		items[i].ProductIDs = productMap[items[i].ID]
	}
	return items, total, nil
}

// GetCouponByID fetches a coupon by its ID.
func (s *CatalogService) GetCouponByID(ctx context.Context, id string) (*catalogmodels.Coupon, error) {
	var coupon catalogmodels.Coupon
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&coupon).Error; err != nil {
		return nil, err
	}
	productMap, err := s.buildCouponProductMap(ctx, []string{coupon.ID})
	if err != nil {
		return nil, err
	}
	coupon.ProductIDs = productMap[coupon.ID]
	return &coupon, nil
}

// UpdateCouponByID applies the given updates to a coupon record.
func (s *CatalogService) UpdateCouponByID(ctx context.Context, id string, updates map[string]interface{}) (int64, error) {
	if len(updates) == 0 {
		return 0, nil
	}
	updates["updated_at"] = time.Now()
	res := s.DB.WithContext(ctx).Model(&catalogmodels.Coupon{}).Where("id = ?", id).Updates(updates)
	return res.RowsAffected, res.Error
}

// DeleteCouponByID soft-deletes a coupon record.
func (s *CatalogService) DeleteCouponByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", id).Delete(&catalogmodels.Coupon{})
	return res.RowsAffected, res.Error
}

func (s *CatalogService) SetCouponProductIDs(ctx context.Context, couponID string, productIDs []string) error {
	normalized := NormalizeCouponProductIDs(productIDs)
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("coupon_id = ?", couponID).Delete(&catalogmodels.CouponProduct{}).Error; err != nil {
			return err
		}
		if len(normalized) == 0 {
			return nil
		}
		relations := make([]catalogmodels.CouponProduct, 0, len(normalized))
		for _, productID := range normalized {
			relations = append(relations, catalogmodels.CouponProduct{
				CouponID:  couponID,
				ProductID: productID,
			})
		}
		return tx.Create(&relations).Error
	})
}

func (s *CatalogService) buildCouponProductMap(ctx context.Context, couponIDs []string) (map[string][]string, error) {
	result := make(map[string][]string)
	if len(couponIDs) == 0 {
		return result, nil
	}
	var relations []catalogmodels.CouponProduct
	if err := s.DB.WithContext(ctx).
		Select("coupon_id, product_id").
		Where("coupon_id IN ?", couponIDs).
		Order("coupon_id, product_id").
		Find(&relations).Error; err != nil {
		return nil, err
	}
	for _, rel := range relations {
		result[rel.CouponID] = append(result[rel.CouponID], rel.ProductID)
	}
	return result, nil
}

func NormalizeCouponProductIDs(ids []string) []string {
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
