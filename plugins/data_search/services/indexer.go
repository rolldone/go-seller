package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

func (s *SearchService) dbFor(db *gorm.DB) (*gorm.DB, error) {
	if db != nil {
		return db, nil
	}
	if s.DB != nil {
		return s.DB, nil
	}
	return nil, fmt.Errorf("data_search: database is unavailable")
}

func compactText(parts ...string) string {
	joined := strings.Join(parts, " ")
	return strings.Join(strings.Fields(joined), " ")
}

func nonEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func collectJSONStrings(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return ""
	}

	values := make([]string, 0, 8)
	var walk func(any)
	walk = func(value any) {
		switch typed := value.(type) {
		case map[string]any:
			for _, nested := range typed {
				walk(nested)
			}
		case []any:
			for _, nested := range typed {
				walk(nested)
			}
		case string:
			if trimmed := strings.TrimSpace(typed); trimmed != "" {
				values = append(values, trimmed)
			}
		}
	}
	walk(decoded)
	return compactText(values...)
}

func (s *SearchService) upsertSearchRow(ctx context.Context, db *gorm.DB, entityType, entityID, title, slug string, businessID *string, content string) error {
	conn, err := s.dbFor(db)
	if err != nil {
		return err
	}
	return conn.WithContext(ctx).Exec(
		`INSERT INTO search_index (entity_type, entity_id, title, slug, business_id, search_vec, updated_at, deleted_at)
		 VALUES (?, ?, ?, ?, ?, to_tsvector('simple', ?), NOW(), NULL)
		 ON CONFLICT (entity_type, entity_id) DO UPDATE SET
		   title = EXCLUDED.title,
		   slug = EXCLUDED.slug,
		   business_id = EXCLUDED.business_id,
		   search_vec = EXCLUDED.search_vec,
		   updated_at = NOW(),
		   deleted_at = NULL`,
		entityType,
		entityID,
		title,
		slug,
		businessID,
		content,
	).Error
}

func (s *SearchService) markSearchRowDeleted(ctx context.Context, db *gorm.DB, entityType, entityID string) error {
	conn, err := s.dbFor(db)
	if err != nil {
		return err
	}
	return conn.WithContext(ctx).Exec(
		`UPDATE search_index SET deleted_at = NOW(), updated_at = NOW() WHERE entity_type = ? AND entity_id = ?`,
		entityType,
		entityID,
	).Error
}

func (s *SearchService) upsertProductModel(ctx context.Context, db *gorm.DB, product *catalogmodels.Product) error {
	return s.upsertSearchRow(
		ctx,
		db,
		"product",
		product.ID,
		product.Name,
		product.Slug,
		product.BusinessID,
		compactText(
			product.Name,
			nonEmpty(product.ShortDescription),
			nonEmpty(product.DescriptionPlain),
			nonEmpty(product.Description),
			collectJSONStrings(product.SEOContent),
		),
	)
}

func (s *SearchService) upsertBusinessModel(ctx context.Context, db *gorm.DB, business *catalogmodels.Business) error {
	return s.upsertSearchRow(
		ctx,
		db,
		"business",
		business.ID,
		business.Name,
		business.Slug,
		nil,
		compactText(
			business.Name,
			nonEmpty(business.ShortDescription),
			nonEmpty(business.DescriptionPlain),
			nonEmpty(business.Description),
		),
	)
}

func (s *SearchService) upsertCategoryModel(ctx context.Context, db *gorm.DB, category *catalogmodels.Category) error {
	return s.upsertSearchRow(
		ctx,
		db,
		"category",
		category.ID,
		category.Name,
		category.Slug,
		nil,
		compactText(
			category.Name,
			nonEmpty(category.ShortDescription),
			nonEmpty(category.DescriptionPlain),
			nonEmpty(category.Description),
			collectJSONStrings(json.RawMessage(category.DescriptionBlocks)),
			collectJSONStrings(category.SEOContent),
		),
	)
}

// UpsertProduct refreshes the search_index row for a product.
func (s *SearchService) UpsertProduct(ctx context.Context, db *gorm.DB, productID string) error {
	conn, err := s.dbFor(db)
	if err != nil {
		return err
	}

	var product catalogmodels.Product
	if err := conn.WithContext(ctx).Unscoped().Where("id = ?", productID).First(&product).Error; err != nil {
		return err
	}

	return s.upsertProductModel(ctx, db, &product)
}

// DeleteProduct soft-deletes the search_index row for a product.
func (s *SearchService) DeleteProduct(ctx context.Context, db *gorm.DB, productID string) error {
	return s.markSearchRowDeleted(ctx, db, "product", productID)
}

// UpsertBusiness refreshes the search_index row for a business.
func (s *SearchService) UpsertBusiness(ctx context.Context, db *gorm.DB, businessID string) error {
	conn, err := s.dbFor(db)
	if err != nil {
		return err
	}

	var business catalogmodels.Business
	if err := conn.WithContext(ctx).Unscoped().Where("id = ?", businessID).First(&business).Error; err != nil {
		return err
	}

	return s.upsertBusinessModel(ctx, db, &business)
}

// DeleteBusiness soft-deletes the search_index row for a business.
func (s *SearchService) DeleteBusiness(ctx context.Context, db *gorm.DB, businessID string) error {
	return s.markSearchRowDeleted(ctx, db, "business", businessID)
}

// UpsertCategory refreshes the search_index row for a category.
func (s *SearchService) UpsertCategory(ctx context.Context, db *gorm.DB, categoryID string) error {
	conn, err := s.dbFor(db)
	if err != nil {
		return err
	}

	var category catalogmodels.Category
	if err := conn.WithContext(ctx).Unscoped().Where("id = ?", categoryID).First(&category).Error; err != nil {
		return err
	}

	return s.upsertCategoryModel(ctx, db, &category)
}

// DeleteCategory soft-deletes the search_index row for a category.
func (s *SearchService) DeleteCategory(ctx context.Context, db *gorm.DB, categoryID string) error {
	return s.markSearchRowDeleted(ctx, db, "category", categoryID)
}

func (s *SearchService) reindexProductsTx(ctx context.Context, tx *gorm.DB) error {
	var products []catalogmodels.Product
	return tx.WithContext(ctx).FindInBatches(&products, 200, func(batchTx *gorm.DB, _ int) error {
		for i := range products {
			if err := s.upsertProductModel(ctx, batchTx, &products[i]); err != nil {
				return err
			}
		}
		return nil
	}).Error
}

func (s *SearchService) reindexBusinessesTx(ctx context.Context, tx *gorm.DB) error {
	var businesses []catalogmodels.Business
	return tx.WithContext(ctx).FindInBatches(&businesses, 200, func(batchTx *gorm.DB, _ int) error {
		for i := range businesses {
			if err := s.upsertBusinessModel(ctx, batchTx, &businesses[i]); err != nil {
				return err
			}
		}
		return nil
	}).Error
}

func (s *SearchService) reindexCategoriesTx(ctx context.Context, tx *gorm.DB) error {
	var categories []catalogmodels.Category
	return tx.WithContext(ctx).FindInBatches(&categories, 200, func(batchTx *gorm.DB, _ int) error {
		for i := range categories {
			if err := s.upsertCategoryModel(ctx, batchTx, &categories[i]); err != nil {
				return err
			}
		}
		return nil
	}).Error
}

// ReindexAll rebuilds the search_index table from the catalog source tables.
func (s *SearchService) ReindexAll(ctx context.Context, db *gorm.DB) error {
	conn, err := s.dbFor(db)
	if err != nil {
		return err
	}

	return conn.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM search_index").Error; err != nil {
			return err
		}
		if err := s.reindexProductsTx(ctx, tx); err != nil {
			return err
		}
		if err := s.reindexBusinessesTx(ctx, tx); err != nil {
			return err
		}
		return s.reindexCategoriesTx(ctx, tx)
	})
}

// ReindexScope rebuilds one entity family (product, business, category).
func (s *SearchService) ReindexScope(ctx context.Context, db *gorm.DB, entityType string) error {
	conn, err := s.dbFor(db)
	if err != nil {
		return err
	}

	scope := strings.ToLower(strings.TrimSpace(entityType))
	switch scope {
	case "product", "business", "category":
	default:
		return fmt.Errorf("data_search: unknown entity type %q", entityType)
	}

	return conn.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM search_index WHERE entity_type = ?", scope).Error; err != nil {
			return err
		}
		switch scope {
		case "product":
			return s.reindexProductsTx(ctx, tx)
		case "business":
			return s.reindexBusinessesTx(ctx, tx)
		case "category":
			return s.reindexCategoriesTx(ctx, tx)
		default:
			return fmt.Errorf("data_search: unknown entity type %q", entityType)
		}
	})
}

// ReindexOne rebuilds a single entity row in search_index.
func (s *SearchService) ReindexOne(ctx context.Context, db *gorm.DB, entityType, entityID string) error {
	switch strings.ToLower(strings.TrimSpace(entityType)) {
	case "product":
		return s.UpsertProduct(ctx, db, entityID)
	case "business":
		return s.UpsertBusiness(ctx, db, entityID)
	case "category":
		return s.UpsertCategory(ctx, db, entityID)
	default:
		return fmt.Errorf("data_search: unknown entity type %q", entityType)
	}
}
