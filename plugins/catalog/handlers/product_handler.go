package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ProductHandler handles HTTP operations for products.
type ProductHandler struct {
	svc *catalogservices.CatalogService
}

// NewProductHandler creates a ProductHandler.
func NewProductHandler(svc *catalogservices.CatalogService) *ProductHandler {
	return &ProductHandler{svc: svc}
}

type createProductRequest struct {
	SKU               string          `json:"sku"`
	Name              string          `json:"name"`
	Slug              string          `json:"slug"`
	Description       *string         `json:"description"`
	DescriptionHTML   *string         `json:"description_html"`
	DescriptionPlain  *string         `json:"description_plain"`
	DescriptionBlocks json.RawMessage `json:"description_blocks"`
	ShortDescription  *string         `json:"short_description"`
	Price             float64         `json:"price"`
	SalePrice         *float64        `json:"sale_price"`
	Status            string          `json:"status"`
	StockStatus       string          `json:"stock_status"`
	IsVisible         *bool           `json:"is_visible"`
	IsNegotiate       *bool           `json:"is_negotiate"`
	SEOContent        json.RawMessage `json:"seo_content"`
	Attributes        json.RawMessage `json:"attributes"`
	BusinessID        *string         `json:"business_id"`
	CategoryIDs       []string        `json:"category_ids"`
	TagIDs            []string        `json:"tag_ids"`
	ProductType       string          `json:"product_type"`
	// Tax & price override
	TaxType          string   `json:"tax_type"`
	TaxRate          float64  `json:"tax_rate"`
	CustomTax        bool     `json:"custom_tax"`
	PriceOverride    bool     `json:"price_override_enabled"`
	Weight           *float64 `json:"weight"`
	DimensionsLength *float64 `json:"dimensions_length"`
	DimensionsWidth  *float64 `json:"dimensions_width"`
	DimensionsHeight *float64 `json:"dimensions_height"`
}

type updateProductRequest struct {
	SKU               *string         `json:"sku"`
	Name              *string         `json:"name"`
	Slug              *string         `json:"slug"`
	Description       *string         `json:"description"`
	DescriptionHTML   *string         `json:"description_html"`
	DescriptionPlain  *string         `json:"description_plain"`
	DescriptionBlocks json.RawMessage `json:"description_blocks"`
	ShortDescription  *string         `json:"short_description"`
	Price             *float64        `json:"price"`
	SalePrice         *float64        `json:"sale_price"`
	Status            *string         `json:"status"`
	StockStatus       *string         `json:"stock_status"`
	IsVisible         *bool           `json:"is_visible"`
	IsNegotiate       *bool           `json:"is_negotiate"`
	SEOContent        json.RawMessage `json:"seo_content"`
	Attributes        json.RawMessage `json:"attributes"`
	BusinessID        *string         `json:"business_id"`
	CategoryIDs       *[]string       `json:"category_ids"`
	TagIDs            *[]string       `json:"tag_ids"`
	ProductType       *string         `json:"product_type"`
	// Tax & price override
	TaxType          *string  `json:"tax_type"`
	TaxRate          *float64 `json:"tax_rate"`
	CustomTax        *bool    `json:"custom_tax"`
	PriceOverride    *bool    `json:"price_override_enabled"`
	Weight           *float64 `json:"weight"`
	DimensionsLength *float64 `json:"dimensions_length"`
	DimensionsWidth  *float64 `json:"dimensions_width"`
	DimensionsHeight *float64 `json:"dimensions_height"`
}

type upsertProductTranslationRequest struct {
	Name              string          `json:"name"`
	Slug              string          `json:"slug"`
	Description       *string         `json:"description"`
	DescriptionHTML   *string         `json:"description_html"`
	DescriptionPlain  *string         `json:"description_plain"`
	DescriptionBlocks json.RawMessage `json:"description_blocks"`
	ShortDescription  *string         `json:"short_description"`
	SEOContent        json.RawMessage `json:"seo_content"`
}

type productResponse struct {
	catalogmodels.Product
	CategoryIDs []string               `json:"category_ids"`
	TagIDs      []string               `json:"tag_ids"`
	Gallery     []productAssetResponse `json:"gallery,omitempty"`
}

type productAssetResponse struct {
	ID           string `json:"id"`
	ProductID    string `json:"product_id,omitempty"`
	FilePath     string `json:"file_path,omitempty"`
	PublicURL    string `json:"public_url,omitempty"`
	IsMain       bool   `json:"is_main"`
	UsageTag     string `json:"usage_tag,omitempty"`
	DisplayOrder int    `json:"display_order,omitempty"`
}

func parseBoolParam(v string) (*bool, error) {
	if strings.TrimSpace(v) == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func parseIntParam(v string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func validateOptionalNonNegativeFloat(field string, value *float64) error {
	if value != nil && *value < 0 {
		return errors.New(field + " must be >= 0")
	}
	return nil
}

func applyTranslation(product *catalogmodels.Product, tr catalogmodels.ProductTranslation) {
	if strings.TrimSpace(tr.Name) != "" {
		product.Name = tr.Name
	}
	if strings.TrimSpace(tr.Slug) != "" {
		product.Slug = tr.Slug
	}
	if tr.Description != nil {
		product.Description = tr.Description
	}
	if tr.ShortDescription != nil {
		product.ShortDescription = tr.ShortDescription
	}
	if len(tr.SEOContent) > 0 {
		product.SEOContent = tr.SEOContent
	}
}

func normalizeProductAssetURL(base string, asset catalogmodels.ProductAsset) string {
	url := strings.TrimSpace(asset.PublicURL)
	if url == "" && strings.TrimSpace(asset.FilePath) != "" {
		url = "/assets/" + strings.TrimSpace(asset.FilePath)
	}
	if url == "" {
		return ""
	}
	if strings.HasPrefix(url, "/") && base != "" {
		return base + url
	}
	return url
}

func buildProductAssetResponses(base string, assets []catalogmodels.ProductAsset) []productAssetResponse {
	if len(assets) == 0 {
		return nil
	}
	out := make([]productAssetResponse, 0, len(assets))
	for _, asset := range assets {
		publicURL := normalizeProductAssetURL(base, asset)
		if publicURL == "" {
			continue
		}
		out = append(out, productAssetResponse{
			ID:           asset.ID,
			ProductID:    asset.ProductID,
			FilePath:     asset.FilePath,
			PublicURL:    publicURL,
			IsMain:       asset.IsMain,
			UsageTag:     asset.UsageTag,
			DisplayOrder: asset.DisplayOrder,
		})
	}
	return out
}

func (h *ProductHandler) Create(c *gin.Context) {
	var req createProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.SKU == "" || req.Name == "" || req.Price < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sku, name are required and price must be >= 0"})
		return
	}
	if err := validateOptionalNonNegativeFloat("weight", req.Weight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_length", req.DimensionsLength); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_width", req.DimensionsWidth); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_height", req.DimensionsHeight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p := &catalogmodels.Product{
		ID:                id,
		SKU:               req.SKU,
		Name:              req.Name,
		Slug:              req.Slug,
		Description:       req.Description,
		DescriptionHTML:   req.DescriptionHTML,
		DescriptionPlain:  req.DescriptionPlain,
		DescriptionBlocks: blocksJSON,
		ShortDescription:  req.ShortDescription,
		Price:             req.Price,
		SalePrice:         req.SalePrice,
		Status:            req.Status,
		StockStatus:       req.StockStatus,
		BusinessID:        req.BusinessID,
		SEOContent:        req.SEOContent,
		Attributes:        req.Attributes,
		ProductType:       req.ProductType,
		TaxType:           req.TaxType,
		TaxRate:           req.TaxRate,
		CustomTax:         req.CustomTax,
		PriceOverride:     req.PriceOverride,
		Weight:            req.Weight,
		DimensionsLength:  req.DimensionsLength,
		DimensionsWidth:   req.DimensionsWidth,
		DimensionsHeight:  req.DimensionsHeight,
	}
	if req.IsVisible != nil {
		p.IsVisible = *req.IsVisible
	} else {
		p.IsVisible = true
	}
	if req.IsNegotiate != nil {
		p.IsNegotiate = *req.IsNegotiate
	}
	// validate product_type
	if strings.TrimSpace(p.ProductType) == "" {
		p.ProductType = "product"
	}
	if p.ProductType != "product" && p.ProductType != "service" && p.ProductType != "digital" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_type"})
		return
	}

	if err := h.svc.CreateProduct(c.Request.Context(), p, req.CategoryIDs, req.TagIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	categoryIDs, err := h.svc.GetCategoryIDsByProductID(c.Request.Context(), p.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagIDs, err := h.svc.GetTagIDsByProductID(c.Request.Context(), p.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, productResponse{Product: *p, CategoryIDs: categoryIDs, TagIDs: tagIDs})
}
func (h *ProductHandler) MemberList(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	filter := catalogservices.ProductListFilter{
		Query:       c.Query("q"),
		SKU:         c.Query("sku"),
		Slug:        c.Query("slug"),
		Status:      c.Query("status"),
		StockStatus: c.Query("stock_status"),
		BusinessID:  c.Query("business_id"),
		CategoryID:  c.Query("category_id"),
		TagID:       c.Query("tag_id"),
		ProductType: c.Query("product_type"),
		Page:        parseIntParam(c.Query("page"), 1),
		Limit:       parseIntParam(c.Query("limit"), 20),
	}
	if visible, err := parseBoolParam(c.Query("is_visible")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid is_visible value"})
		return
	} else {
		filter.IsVisible = visible
	}

	items, total, err := h.svc.ListProductsForMember(c.Request.Context(), memberID, filter)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Enrich product list with translations, category IDs and tag IDs so frontend can render relations
	ids := make([]string, 0, len(items))
	for _, p := range items {
		ids = append(ids, p.ID)
	}
	locale := strings.TrimSpace(c.Query("locale"))
	translationMap, err := h.svc.GetProductTranslationMapByProductIDs(c.Request.Context(), ids, locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	out := make([]productResponse, 0, len(items))
	for _, p := range items {
		if tr, ok := translationMap[p.ID]; ok {
			applyTranslation(&p, tr)
		}
		// Use preloaded Categories if available
		catIDs := make([]string, 0, len(p.Categories))
		for _, cat := range p.Categories {
			catIDs = append(catIDs, cat.ID)
		}
		tagIDs := make([]string, 0, len(p.Tags))
		for _, tag := range p.Tags {
			tagIDs = append(tagIDs, tag.ID)
		}
		out = append(out, productResponse{Product: p, CategoryIDs: catIDs, TagIDs: tagIDs})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "total": total})
}

func (h *ProductHandler) MemberCreate(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	var req createProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.SKU == "" || req.Name == "" || req.Price < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sku, name are required and price must be >= 0"})
		return
	}
	if err := validateOptionalNonNegativeFloat("weight", req.Weight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_length", req.DimensionsLength); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_width", req.DimensionsWidth); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_height", req.DimensionsHeight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ownedIDs, err := h.svc.ListBusinessIDsForMember(c.Request.Context(), memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req.BusinessID == nil || strings.TrimSpace(*req.BusinessID) == "" {
		if len(ownedIDs) == 1 {
			businessID := ownedIDs[0]
			req.BusinessID = &businessID
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
			return
		}
	} else if _, err := h.svc.GetBusinessByIDForMember(c.Request.Context(), memberID, strings.TrimSpace(*req.BusinessID)); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "business is not owned by current member"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p := &catalogmodels.Product{
		ID:                id,
		SKU:               req.SKU,
		Name:              req.Name,
		Slug:              req.Slug,
		Description:       req.Description,
		DescriptionHTML:   req.DescriptionHTML,
		DescriptionPlain:  req.DescriptionPlain,
		DescriptionBlocks: blocksJSON,
		ShortDescription:  req.ShortDescription,
		Price:             req.Price,
		SalePrice:         req.SalePrice,
		Status:            req.Status,
		StockStatus:       req.StockStatus,
		BusinessID:        req.BusinessID,
		SEOContent:        req.SEOContent,
		Attributes:        req.Attributes,
		ProductType:       req.ProductType,
		TaxType:           req.TaxType,
		TaxRate:           req.TaxRate,
		CustomTax:         req.CustomTax,
		PriceOverride:     req.PriceOverride,
		Weight:            req.Weight,
		DimensionsLength:  req.DimensionsLength,
		DimensionsWidth:   req.DimensionsWidth,
		DimensionsHeight:  req.DimensionsHeight,
	}
	if req.IsVisible != nil {
		p.IsVisible = *req.IsVisible
	} else {
		p.IsVisible = true
	}
	if req.IsNegotiate != nil {
		p.IsNegotiate = *req.IsNegotiate
	}
	if strings.TrimSpace(p.ProductType) == "" {
		p.ProductType = "product"
	}
	if p.ProductType != "product" && p.ProductType != "service" && p.ProductType != "digital" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_type"})
		return
	}

	if err := h.svc.CreateProduct(c.Request.Context(), p, req.CategoryIDs, req.TagIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	categoryIDs, err := h.svc.GetCategoryIDsByProductID(c.Request.Context(), p.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagIDs, err := h.svc.GetTagIDsByProductID(c.Request.Context(), p.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, productResponse{Product: *p, CategoryIDs: categoryIDs, TagIDs: tagIDs})
}

func (h *ProductHandler) MemberGetByID(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	product, err := h.svc.GetProductByIDForMember(c.Request.Context(), memberID, c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	categoryIDs, err := h.svc.GetCategoryIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagIDs, err := h.svc.GetTagIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, productResponse{Product: *product, CategoryIDs: categoryIDs, TagIDs: tagIDs})
}

func (h *ProductHandler) MemberUpdate(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	var req updateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	product, err := h.svc.GetProductByIDForMember(c.Request.Context(), memberID, c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.SKU != nil {
		product.SKU = *req.SKU
	}
	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.Slug != nil {
		product.Slug = *req.Slug
	}
	if req.Description != nil {
		product.Description = req.Description
	}
	if req.DescriptionHTML != nil {
		product.DescriptionHTML = req.DescriptionHTML
	}
	if req.DescriptionPlain != nil {
		product.DescriptionPlain = req.DescriptionPlain
	}
	if len(req.DescriptionBlocks) > 0 {
		blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		product.DescriptionBlocks = blocksJSON
	}
	if req.ShortDescription != nil {
		product.ShortDescription = req.ShortDescription
	}
	if req.Price != nil {
		if *req.Price < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "price must be >= 0"})
			return
		}
		product.Price = *req.Price
	}
	if req.SalePrice != nil {
		if *req.SalePrice < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sale_price must be >= 0"})
			return
		}
		product.SalePrice = req.SalePrice
	}
	if req.Status != nil {
		product.Status = *req.Status
	}
	if req.StockStatus != nil {
		product.StockStatus = *req.StockStatus
	}
	if req.IsVisible != nil {
		product.IsVisible = *req.IsVisible
	}
	if req.IsNegotiate != nil {
		product.IsNegotiate = *req.IsNegotiate
	}
	if req.BusinessID != nil {
		trimmed := strings.TrimSpace(*req.BusinessID)
		if trimmed == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
			return
		}
		if _, err := h.svc.GetBusinessByIDForMember(c.Request.Context(), memberID, trimmed); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "business is not owned by current member"})
			return
		}
		product.BusinessID = &trimmed
	}
	if req.ProductType != nil {
		pt := strings.TrimSpace(*req.ProductType)
		if pt == "" {
			pt = "product"
		}
		if pt != "product" && pt != "service" && pt != "digital" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_type"})
			return
		}
		product.ProductType = pt
	}
	if req.TaxType != nil {
		product.TaxType = *req.TaxType
	}
	if req.TaxRate != nil {
		product.TaxRate = *req.TaxRate
	}
	if req.CustomTax != nil {
		product.CustomTax = *req.CustomTax
	}
	if req.PriceOverride != nil {
		product.PriceOverride = *req.PriceOverride
	}
	if err := validateOptionalNonNegativeFloat("weight", req.Weight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_length", req.DimensionsLength); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_width", req.DimensionsWidth); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_height", req.DimensionsHeight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Weight != nil {
		product.Weight = req.Weight
	}
	if req.DimensionsLength != nil {
		product.DimensionsLength = req.DimensionsLength
	}
	if req.DimensionsWidth != nil {
		product.DimensionsWidth = req.DimensionsWidth
	}
	if req.DimensionsHeight != nil {
		product.DimensionsHeight = req.DimensionsHeight
	}
	if len(req.SEOContent) > 0 {
		product.SEOContent = req.SEOContent
	}
	if len(req.Attributes) > 0 {
		product.Attributes = req.Attributes
	}

	categoryIDs, err := h.svc.GetCategoryIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req.CategoryIDs != nil {
		categoryIDs = *req.CategoryIDs
	}
	tagIDs, err := h.svc.GetTagIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req.TagIDs != nil {
		tagIDs = *req.TagIDs
	}

	if err := h.svc.UpdateProduct(c.Request.Context(), product, categoryIDs, tagIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	categoryIDs, err = h.svc.GetCategoryIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagIDs, err = h.svc.GetTagIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, productResponse{Product: *product, CategoryIDs: categoryIDs, TagIDs: tagIDs})
}

func (h *ProductHandler) MemberDelete(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	affected, err := h.svc.DeleteProductByIDForMember(c.Request.Context(), memberID, c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

func (h *ProductHandler) MemberPublish(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	affected, err := h.svc.SetProductPublishStateForMember(c.Request.Context(), memberID, c.Param("id"), true)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": affected, "status": "published"})
}

func (h *ProductHandler) MemberUnpublish(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	affected, err := h.svc.SetProductPublishStateForMember(c.Request.Context(), memberID, c.Param("id"), false)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": affected, "status": "draft"})
}

func (h *ProductHandler) List(c *gin.Context) {
	isVisible, err := parseBoolParam(c.Query("is_visible"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid is_visible value"})
		return
	}

	products, total, err := h.svc.ListProducts(c.Request.Context(), catalogservices.ProductListFilter{
		Query:       c.Query("q"),
		SKU:         c.Query("sku"),
		Slug:        c.Query("slug"),
		Status:      c.Query("status"),
		StockStatus: c.Query("stock_status"),
		BusinessID:  c.Query("business_id"),
		CategoryID:  c.Query("category_id"),
		TagID:       c.Query("tag_id"),
		ProductType: c.Query("product_type"),
		IsVisible:   isVisible,
		Page:        parseIntParam(c.Query("page"), 1),
		Limit:       parseIntParam(c.Query("limit"), 20),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ids := make([]string, 0, len(products))
	locale := strings.TrimSpace(c.Query("locale"))
	for _, p := range products {
		ids = append(ids, p.ID)
	}
	translationMap, err := h.svc.GetProductTranslationMapByProductIDs(c.Request.Context(), ids, locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	items := make([]productResponse, 0, len(products))
	for _, p := range products {
		if tr, ok := translationMap[p.ID]; ok {
			applyTranslation(&p, tr)
		}
		catIDs := make([]string, 0, len(p.Categories))
		for _, cat := range p.Categories {
			catIDs = append(catIDs, cat.ID)
		}
		tagIDs := make([]string, 0, len(p.Tags))
		for _, tag := range p.Tags {
			tagIDs = append(tagIDs, tag.ID)
		}
		items = append(items, productResponse{Product: p, CategoryIDs: catIDs, TagIDs: tagIDs})
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *ProductHandler) PublicList(c *gin.Context) {
	parseCSV := func(value string) []string {
		if strings.TrimSpace(value) == "" {
			return nil
		}
		parts := strings.Split(value, ",")
		out := make([]string, 0, len(parts))
		for _, part := range parts {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				out = append(out, trimmed)
			}
		}
		return out
	}

	base := strings.TrimRight(os.Getenv("APP_URL"), "/")

	products, total, err := h.svc.ListProducts(c.Request.Context(), catalogservices.ProductListFilter{
		Query:         c.Query("q"),
		SKU:           c.Query("sku"),
		Slug:          c.Query("slug"),
		StockStatus:   c.Query("stock_status"),
		IDs:           parseCSV(c.Query("ids")),
		BusinessIDs:   parseCSV(c.Query("business_ids")),
		CategoryIDs:   parseCSV(c.Query("category_ids")),
		TagIDs:        parseCSV(c.Query("tag_ids")),
		ProductType:   c.Query("product_type"),
		OnlyPublished: true,
		Page:          parseIntParam(c.Query("page"), 1),
		Limit:         parseIntParam(c.Query("limit"), 20),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	locale := strings.TrimSpace(c.Query("locale"))
	ids := make([]string, 0, len(products))
	for _, p := range products {
		ids = append(ids, p.ID)
	}
	translationMap, err := h.svc.GetProductTranslationMapByProductIDs(c.Request.Context(), ids, locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	assetMap, err := h.svc.GetProductAssetsForProductIDs(c.Request.Context(), ids, "gallery")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	items := make([]productResponse, 0, len(products))
	for _, p := range products {
		if tr, ok := translationMap[p.ID]; ok {
			applyTranslation(&p, tr)
		}
		catIDs := make([]string, 0, len(p.Categories))
		for _, cat := range p.Categories {
			catIDs = append(catIDs, cat.ID)
		}
		tagIDs := make([]string, 0, len(p.Tags))
		for _, tag := range p.Tags {
			tagIDs = append(tagIDs, tag.ID)
		}
		items = append(items, productResponse{
			Product:     p,
			CategoryIDs: catIDs,
			TagIDs:      tagIDs,
			Gallery:     buildProductAssetResponses(base, assetMap[p.ID]),
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

// PublicListByBusinessSlug lists published products for a business identified by slug.
func (h *ProductHandler) PublicListByBusinessSlug(c *gin.Context) {
	slug := c.Param("slug")
	// resolve business by slug to get its ID
	biz, err := h.svc.GetBusinessBySlug(c.Request.Context(), slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// accept both q and search as query param
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		q = strings.TrimSpace(c.Query("search"))
	}

	products, total, err := h.svc.ListProducts(c.Request.Context(), catalogservices.ProductListFilter{
		Query:         q,
		OnlyPublished: true,
		BusinessID:    biz.ID,
		Page:          parseIntParam(c.Query("page"), 1),
		Limit:         parseIntParam(c.Query("limit"), 20),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	locale := strings.TrimSpace(c.Query("locale"))
	base := strings.TrimRight(os.Getenv("APP_URL"), "/")
	ids := make([]string, 0, len(products))
	for _, p := range products {
		ids = append(ids, p.ID)
	}
	translationMap, err := h.svc.GetProductTranslationMapByProductIDs(c.Request.Context(), ids, locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	assetMap, err := h.svc.GetProductAssetsForProductIDs(c.Request.Context(), ids, "gallery")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	items := make([]productResponse, 0, len(products))
	for _, p := range products {
		if tr, ok := translationMap[p.ID]; ok {
			applyTranslation(&p, tr)
		}
		catIDs := make([]string, 0, len(p.Categories))
		for _, cat := range p.Categories {
			catIDs = append(catIDs, cat.ID)
		}
		tagIDs := make([]string, 0, len(p.Tags))
		for _, tag := range p.Tags {
			tagIDs = append(tagIDs, tag.ID)
		}
		items = append(items, productResponse{
			Product:     p,
			CategoryIDs: catIDs,
			TagIDs:      tagIDs,
			Gallery:     buildProductAssetResponses(base, assetMap[p.ID]),
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *ProductHandler) GetByID(c *gin.Context) {
	product, err := h.svc.GetProductByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	categoryIDs, err := h.svc.GetCategoryIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagIDs, err := h.svc.GetTagIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	locale := strings.TrimSpace(c.Query("locale"))
	translationMap, err := h.svc.GetProductTranslationMapByProductIDs(c.Request.Context(), []string{product.ID}, locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tr, ok := translationMap[product.ID]; ok {
		applyTranslation(product, tr)
	}
	c.JSON(http.StatusOK, productResponse{Product: *product, CategoryIDs: categoryIDs, TagIDs: tagIDs})
}

func (h *ProductHandler) PublicGetByID(c *gin.Context) {
	product, err := h.svc.GetPublishedProductByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	categoryIDs, err := h.svc.GetCategoryIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagIDs, err := h.svc.GetTagIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	locale := strings.TrimSpace(c.Query("locale"))
	translationMap, err := h.svc.GetProductTranslationMapByProductIDs(c.Request.Context(), []string{product.ID}, locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tr, ok := translationMap[product.ID]; ok {
		applyTranslation(product, tr)
	}
	c.JSON(http.StatusOK, productResponse{Product: *product, CategoryIDs: categoryIDs, TagIDs: tagIDs})
}

func (h *ProductHandler) UpsertTranslation(c *gin.Context) {
	productID := c.Param("id")
	locale := c.Param("locale")
	var req upsertProductTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	seoJSON, err := normalizeRawJSON(req.SEOContent)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "seo_content must be valid JSON"})
		return
	}
	item, err := h.svc.UpsertProductTranslation(
		c.Request.Context(),
		productID,
		locale,
		req.Name,
		req.Slug,
		req.Description,
		req.DescriptionHTML,
		req.DescriptionPlain,
		blocksJSON,
		req.ShortDescription,
		json.RawMessage(seoJSON),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *ProductHandler) ListTranslations(c *gin.Context) {
	productID := c.Param("id")
	items, err := h.svc.ListProductTranslations(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *ProductHandler) Update(c *gin.Context) {
	var req updateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	product, err := h.svc.GetProductByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.SKU != nil {
		product.SKU = *req.SKU
	}
	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.Slug != nil {
		product.Slug = *req.Slug
	}
	if req.Description != nil {
		product.Description = req.Description
	}
	if req.DescriptionHTML != nil {
		product.DescriptionHTML = req.DescriptionHTML
	}
	if req.DescriptionPlain != nil {
		product.DescriptionPlain = req.DescriptionPlain
	}
	if len(req.DescriptionBlocks) > 0 {
		blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		product.DescriptionBlocks = blocksJSON
	}
	if req.ShortDescription != nil {
		product.ShortDescription = req.ShortDescription
	}
	if req.Price != nil {
		if *req.Price < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "price must be >= 0"})
			return
		}
		product.Price = *req.Price
	}
	if req.SalePrice != nil {
		if *req.SalePrice < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sale_price must be >= 0"})
			return
		}
		product.SalePrice = req.SalePrice
	}
	if req.Status != nil {
		product.Status = *req.Status
	}
	if req.StockStatus != nil {
		product.StockStatus = *req.StockStatus
	}
	if req.IsVisible != nil {
		product.IsVisible = *req.IsVisible
	}
	if req.IsNegotiate != nil {
		product.IsNegotiate = *req.IsNegotiate
	}
	if req.BusinessID != nil {
		trimmed := strings.TrimSpace(*req.BusinessID)
		if trimmed == "" {
			product.BusinessID = nil
		} else {
			product.BusinessID = &trimmed
		}
	}
	if req.ProductType != nil {
		pt := strings.TrimSpace(*req.ProductType)
		if pt == "" {
			pt = "product"
		}
		if pt != "product" && pt != "service" && pt != "digital" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_type"})
			return
		}
		product.ProductType = pt
	}
	if req.TaxType != nil {
		product.TaxType = *req.TaxType
	}
	if req.TaxRate != nil {
		product.TaxRate = *req.TaxRate
	}
	if req.CustomTax != nil {
		product.CustomTax = *req.CustomTax
	}
	if req.PriceOverride != nil {
		product.PriceOverride = *req.PriceOverride
	}
	if err := validateOptionalNonNegativeFloat("weight", req.Weight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_length", req.DimensionsLength); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_width", req.DimensionsWidth); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOptionalNonNegativeFloat("dimensions_height", req.DimensionsHeight); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Weight != nil {
		product.Weight = req.Weight
	}
	if req.DimensionsLength != nil {
		product.DimensionsLength = req.DimensionsLength
	}
	if req.DimensionsWidth != nil {
		product.DimensionsWidth = req.DimensionsWidth
	}
	if req.DimensionsHeight != nil {
		product.DimensionsHeight = req.DimensionsHeight
	}
	if len(req.SEOContent) > 0 {
		product.SEOContent = req.SEOContent
	}
	if len(req.Attributes) > 0 {
		product.Attributes = req.Attributes
	}

	categoryIDs, err := h.svc.GetCategoryIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req.CategoryIDs != nil {
		categoryIDs = *req.CategoryIDs
	}
	tagIDs, err := h.svc.GetTagIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req.TagIDs != nil {
		tagIDs = *req.TagIDs
	}

	if err := h.svc.UpdateProduct(c.Request.Context(), product, categoryIDs, tagIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	categoryIDs, err = h.svc.GetCategoryIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagIDs, err = h.svc.GetTagIDsByProductID(c.Request.Context(), product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, productResponse{Product: *product, CategoryIDs: categoryIDs, TagIDs: tagIDs})
}

func (h *ProductHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteProductByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

func (h *ProductHandler) Publish(c *gin.Context) {
	affected, err := h.svc.SetProductPublishState(c.Request.Context(), c.Param("id"), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": affected, "status": "published"})
}

func (h *ProductHandler) Unpublish(c *gin.Context) {
	affected, err := h.svc.SetProductPublishState(c.Request.Context(), c.Param("id"), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": affected, "status": "draft"})
}
