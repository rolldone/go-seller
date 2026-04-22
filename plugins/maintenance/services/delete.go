package services

import (
	"fmt"

	"gorm.io/gorm"
)

// DeleteService handles hard-delete operations for maintenance purposes.
// WARNING: all deletes here are irreversible hard-deletes. Development use only.
type DeleteService struct {
	db *gorm.DB
}

func NewDeleteService(db *gorm.DB) *DeleteService {
	return &DeleteService{db: db}
}

// CountOrders returns the total number of orders.
func (s *DeleteService) CountOrders() (int64, error) {
	var count int64
	if err := s.db.Table("orders").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// PurgeAllOrders hard-deletes all order-related rows in safe dependency order.
// Tables cleaned: payment_gateway_histories → payment_proofs → order_transactions
//
//	→ payments → order_coupons → order_discounts → order_items
//	→ orders → cart_items → carts → wishlists_items → wishlists
func (s *DeleteService) PurgeAllOrders() error {
	tables := []string{
		"payment_gateway_histories",
		"payment_proofs",
		"order_transactions",
		"payments",
		"order_coupons",
		"order_discounts",
		"order_items",
		"orders",
		"cart_items",
		"carts",
		"wishlist_items",
		"wishlists",
	}
	return s.purgeTables(tables)
}

// CountCategories returns the total number of categories (including soft-deleted).
func (s *DeleteService) CountCategories() (int64, error) {
	var count int64
	if err := s.db.Table("categories").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// PurgeAllCategories hard-deletes all category-related rows.
// Tables cleaned: category_translations → categories
func (s *DeleteService) PurgeAllCategories() error {
	tables := []string{
		"category_translations",
		"categories",
	}
	return s.purgeTables(tables)
}

// CountProducts returns the total number of products (including soft-deleted).
func (s *DeleteService) CountProducts() (int64, error) {
	var count int64
	if err := s.db.Table("products").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// PurgeAllProducts hard-deletes all product-related rows.
// Tables cleaned: variation_attributes → variation_assets → product_assets
//
//	→ product_translations → product_variations → products
func (s *DeleteService) PurgeAllProducts() error {
	tables := []string{
		"variation_attributes",
		"variation_assets",
		"product_assets",
		"product_translations",
		"product_variations",
		"products",
	}
	return s.purgeTables(tables)
}

// purgeTables executes DELETE FROM for each table name inside a transaction.
// Each statement uses TRUNCATE … CASCADE is deliberately avoided so the order
// of deletion is explicit and observable. Raw SQL avoids GORM soft-delete hooks.
func (s *DeleteService) purgeTables(tables []string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, t := range tables {
			sql := fmt.Sprintf("DELETE FROM %s", t) //nolint:gosec // table names are hard-coded constants
			if err := tx.Exec(sql).Error; err != nil {
				return fmt.Errorf("failed to purge table %q: %w", t, err)
			}
		}
		return nil
	})
}
