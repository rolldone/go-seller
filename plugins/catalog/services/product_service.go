package services

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

// ProductListFilter controls list query behavior.
type ProductListFilter struct {
	Query         string
	SKU           string
	Slug          string
	Status        string
	StockStatus   string
	IDs           []string
	BusinessID    string
	BusinessIDs   []string
	CategoryID    string
	CategoryIDs   []string
	TagID         string
	TagIDs        []string
	ProductType   string
	IsVisible     *bool
	OnlyPublished bool
	Page          int
	Limit         int
}

// CreateProduct inserts a new product record.
func (s *CatalogService) CreateProduct(ctx context.Context, p *catalogmodels.Product, categoryIDs, tagIDs []string) error {
	if err := s.normalizeProductBusinessID(ctx, p); err != nil {
		return err
	}
	if strings.TrimSpace(p.Slug) == "" {
		p.Slug = makeSlug(p.Name)
	}
	if p.Status == "" {
		p.Status = "draft"
	}
	if p.StockStatus == "" {
		p.StockStatus = "instock"
	}
	uniqueSlug, err := s.ensureUniqueSlug(ctx, p.Slug, "")
	if err != nil {
		return err
	}
	p.Slug = uniqueSlug

	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(p).Error; err != nil {
			return err
		}
		if err := s.syncProductCategoriesTx(ctx, tx, p.ID, categoryIDs); err != nil {
			return err
		}
		if err := s.syncProductTagsTx(ctx, tx, p.ID, tagIDs); err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertProduct(ctx, tx, p.ID)
	})
}

// GetProductByID returns a product by its ID.
func (s *CatalogService) GetProductByID(ctx context.Context, id string) (*catalogmodels.Product, error) {
	var p catalogmodels.Product
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

// GetProductBySKU returns a product by SKU.
func (s *CatalogService) GetProductBySKU(ctx context.Context, sku string) (*catalogmodels.Product, error) {
	var p catalogmodels.Product
	if err := s.DB.WithContext(ctx).Where("sku = ?", sku).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

// DeleteProductByID soft-deletes a product by ID.
func (s *CatalogService) DeleteProductByID(ctx context.Context, id string) (int64, error) {
	var affected int64
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("id = ?", id).Delete(&catalogmodels.Product{})
		if res.Error != nil {
			return res.Error
		}
		affected = res.RowsAffected
		if affected == 0 {
			return nil
		}
		return pluginregistry.SearchIndexDeleteProduct(ctx, tx, id)
	})
	return affected, err
}

// GetPublishedProductByID returns a published product by ID.
func (s *CatalogService) GetPublishedProductByID(ctx context.Context, id string) (*catalogmodels.Product, error) {
	var p catalogmodels.Product
	if err := s.DB.WithContext(ctx).Where("id = ? AND status = ? AND is_visible = ?", id, "published", true).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

// SetProductPublishState updates product status to published/draft.
func (s *CatalogService) SetProductPublishState(ctx context.Context, id string, isPublished bool) (int64, error) {
	status := "draft"
	if isPublished {
		var translation catalogmodels.ProductTranslation
		err := s.DB.WithContext(ctx).
			Where("product_id = ? AND locale = ?", id, "id").
			First(&translation).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return 0, errors.New("cannot publish product: Indonesian translation (locale=id) is required")
			}
			return 0, err
		}
		if strings.TrimSpace(translation.Name) == "" || strings.TrimSpace(translation.Slug) == "" {
			return 0, errors.New("cannot publish product: Indonesian translation must have name and slug")
		}
		status = "published"
	}
	res := s.DB.WithContext(ctx).Model(&catalogmodels.Product{}).Where("id = ?", id).Update("status", status)
	return res.RowsAffected, res.Error
}

// ListProducts returns products with pagination and optional filtering.
func (s *CatalogService) ListProducts(ctx context.Context, f ProductListFilter) ([]catalogmodels.Product, int64, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 20
	}

	q := s.DB.WithContext(ctx).Model(&catalogmodels.Product{})
	if f.OnlyPublished {
		q = q.Where("status = ?", "published").Where("is_visible = ?", true)
	}
	if searchTerm := strings.TrimSpace(f.Query); searchTerm != "" {
		like := "%" + searchTerm + "%"
		// Only compare id = ? when the search term looks like a UUID to avoid
		// Postgres casting errors when comparing uuid column with arbitrary text.
		uuidRegex := regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
		if uuidRegex.MatchString(searchTerm) {
			q = q.Where(
				"name ILIKE ? OR description ILIKE ? OR short_description ILIKE ? OR id = ?",
				like,
				like,
				like,
				searchTerm,
			)
		} else {
			q = q.Where(
				"name ILIKE ? OR description ILIKE ? OR short_description ILIKE ?",
				like,
				like,
				like,
			)
		}
	}
	if strings.TrimSpace(f.SKU) != "" {
		q = q.Where("sku = ?", strings.TrimSpace(f.SKU))
	}
	if strings.TrimSpace(f.Slug) != "" {
		q = q.Where("slug = ?", strings.TrimSpace(f.Slug))
	}
	if strings.TrimSpace(f.Status) != "" {
		q = q.Where("status = ?", strings.TrimSpace(f.Status))
	}
	if strings.TrimSpace(f.StockStatus) != "" {
		q = q.Where("stock_status = ?", strings.TrimSpace(f.StockStatus))
	}
	if len(f.IDs) > 0 {
		q = q.Where("products.id IN ?", normalizeCategoryIDs(f.IDs))
	}
	if strings.TrimSpace(f.BusinessID) != "" {
		q = q.Where("business_id = ?", strings.TrimSpace(f.BusinessID))
	}
	if ids := normalizeCategoryIDs(f.BusinessIDs); len(ids) > 0 {
		q = q.Where("business_id IN ?", ids)
	}
	if strings.TrimSpace(f.ProductType) != "" {
		q = q.Where("product_type = ?", strings.TrimSpace(f.ProductType))
	}
	if strings.TrimSpace(f.CategoryID) != "" {
		q = q.Joins("INNER JOIN product_category_map ON product_category_map.product_id = products.id").
			Where("product_category_map.category_id = ?", strings.TrimSpace(f.CategoryID))
	}
	if ids := normalizeCategoryIDs(f.CategoryIDs); len(ids) > 0 {
		q = q.Joins("INNER JOIN product_category_map ON product_category_map.product_id = products.id").
			Where("product_category_map.category_id IN ?", ids)
	}
	if strings.TrimSpace(f.TagID) != "" {
		q = q.Joins("INNER JOIN product_tag_map ON product_tag_map.product_id = products.id").
			Where("product_tag_map.tag_id = ?", strings.TrimSpace(f.TagID))
	}
	if ids := normalizeCategoryIDs(f.TagIDs); len(ids) > 0 {
		q = q.Joins("INNER JOIN product_tag_map ON product_tag_map.product_id = products.id").
			Where("product_tag_map.tag_id IN ?", ids)
	}
	if f.IsVisible != nil {
		q = q.Where("is_visible = ?", *f.IsVisible)
	}

	if strings.TrimSpace(f.CategoryID) != "" || len(normalizeCategoryIDs(f.CategoryIDs)) > 0 || strings.TrimSpace(f.TagID) != "" || len(normalizeCategoryIDs(f.TagIDs)) > 0 {
		q = q.Distinct()
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (f.Page - 1) * f.Limit
	var products []catalogmodels.Product
	if err := q.Order("created_at desc").Limit(f.Limit).Offset(offset).Find(&products).Error; err != nil {
		return nil, 0, err
	}
	return products, total, nil
}

// UpdateProduct updates a product record and ensures slug constraints.
func (s *CatalogService) UpdateProduct(ctx context.Context, p *catalogmodels.Product, categoryIDs, tagIDs []string) error {
	if err := s.normalizeProductBusinessID(ctx, p); err != nil {
		return err
	}
	if strings.TrimSpace(p.Slug) == "" {
		p.Slug = makeSlug(p.Name)
	}
	uniqueSlug, err := s.ensureUniqueSlug(ctx, p.Slug, p.ID)
	if err != nil {
		return err
	}
	p.Slug = uniqueSlug

	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(p).Error; err != nil {
			return err
		}
		if err := s.syncProductCategoriesTx(ctx, tx, p.ID, categoryIDs); err != nil {
			return err
		}
		if err := s.syncProductTagsTx(ctx, tx, p.ID, tagIDs); err != nil {
			return err
		}
		return pluginregistry.SearchIndexUpsertProduct(ctx, tx, p.ID)
	})
}

func normalizeCategoryIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func normalizeTagIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func (s *CatalogService) syncProductCategoriesTx(ctx context.Context, tx *gorm.DB, productID string, categoryIDs []string) error {
	ids := normalizeCategoryIDs(categoryIDs)

	if err := tx.WithContext(ctx).Where("product_id = ?", productID).Delete(&catalogmodels.ProductCategoryMap{}).Error; err != nil {
		return err
	}

	if len(ids) == 0 {
		return nil
	}

	rows := make([]catalogmodels.ProductCategoryMap, 0, len(ids))
	for _, categoryID := range ids {
		rows = append(rows, catalogmodels.ProductCategoryMap{ProductID: productID, CategoryID: categoryID})
	}
	return tx.WithContext(ctx).Create(&rows).Error
}

func (s *CatalogService) syncProductTagsTx(ctx context.Context, tx *gorm.DB, productID string, tagIDs []string) error {
	ids := normalizeTagIDs(tagIDs)

	if err := tx.WithContext(ctx).Where("product_id = ?", productID).Delete(&catalogmodels.ProductTagMap{}).Error; err != nil {
		return err
	}

	if len(ids) == 0 {
		return nil
	}

	rows := make([]catalogmodels.ProductTagMap, 0, len(ids))
	for _, tagID := range ids {
		rows = append(rows, catalogmodels.ProductTagMap{ProductID: productID, TagID: tagID})
	}
	return tx.WithContext(ctx).Create(&rows).Error
}

func (s *CatalogService) GetCategoryIDsByProductID(ctx context.Context, productID string) ([]string, error) {
	if strings.TrimSpace(productID) == "" {
		return []string{}, nil
	}
	var rows []catalogmodels.ProductCategoryMap
	if err := s.DB.WithContext(ctx).Where("product_id = ?", productID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.CategoryID)
	}
	return out, nil
}

func (s *CatalogService) GetCategoryIDsByProductIDs(ctx context.Context, productIDs []string) (map[string][]string, error) {
	result := make(map[string][]string)
	if len(productIDs) == 0 {
		return result, nil
	}

	var rows []catalogmodels.ProductCategoryMap
	if err := s.DB.WithContext(ctx).Where("product_id IN ?", productIDs).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.ProductID] = append(result[r.ProductID], r.CategoryID)
	}
	for _, id := range productIDs {
		if _, ok := result[id]; !ok {
			result[id] = []string{}
		}
	}
	return result, nil
}

func (s *CatalogService) GetTagIDsByProductID(ctx context.Context, productID string) ([]string, error) {
	if strings.TrimSpace(productID) == "" {
		return []string{}, nil
	}
	var rows []catalogmodels.ProductTagMap
	if err := s.DB.WithContext(ctx).Where("product_id = ?", productID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.TagID)
	}
	return out, nil
}

func (s *CatalogService) GetTagIDsByProductIDs(ctx context.Context, productIDs []string) (map[string][]string, error) {
	result := make(map[string][]string)
	if len(productIDs) == 0 {
		return result, nil
	}

	var rows []catalogmodels.ProductTagMap
	if err := s.DB.WithContext(ctx).Where("product_id IN ?", productIDs).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.ProductID] = append(result[r.ProductID], r.TagID)
	}
	for _, id := range productIDs {
		if _, ok := result[id]; !ok {
			result[id] = []string{}
		}
	}
	return result, nil
}

func (s *CatalogService) ensureUniqueSlug(ctx context.Context, slug, currentID string) (string, error) {
	base := makeSlug(slug)
	candidate := base
	for i := 0; i < 100; i++ {
		var count int64
		q := s.DB.WithContext(ctx).Model(&catalogmodels.Product{}).Where("slug = ?", candidate)
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
	return "", fmt.Errorf("unable to generate unique slug for %q", slug)
}

func (s *CatalogService) normalizeProductBusinessID(ctx context.Context, p *catalogmodels.Product) error {
	if p.BusinessID == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*p.BusinessID)
	if trimmed == "" {
		p.BusinessID = nil
		return nil
	}
	if _, err := s.GetBusinessByID(ctx, trimmed); err != nil {
		return err
	}
	p.BusinessID = &trimmed
	return nil
}
