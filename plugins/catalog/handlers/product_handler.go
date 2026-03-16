package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
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
	TaxType       string  `json:"tax_type"`
	TaxRate       float64 `json:"tax_rate"`
	CustomTax     bool    `json:"custom_tax"`
	PriceOverride bool    `json:"price_override_enabled"`
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
	TaxType       *string  `json:"tax_type"`
	TaxRate       *float64 `json:"tax_rate"`
	CustomTax     *bool    `json:"custom_tax"`
	PriceOverride *bool    `json:"price_override_enabled"`
}

type productResponse struct {
	catalogmodels.Product
	CategoryIDs []string `json:"category_ids"`
	TagIDs      []string `json:"tag_ids"`
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
	for _, p := range products {
		ids = append(ids, p.ID)
	}
	categoryMap, err := h.svc.GetCategoryIDsByProductIDs(c.Request.Context(), ids)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tagMap, err := h.svc.GetTagIDsByProductIDs(c.Request.Context(), ids)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	items := make([]productResponse, 0, len(products))
	for _, p := range products {
		items = append(items, productResponse{Product: p, CategoryIDs: categoryMap[p.ID], TagIDs: tagMap[p.ID]})
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *ProductHandler) PublicList(c *gin.Context) {
	products, total, err := h.svc.ListProducts(c.Request.Context(), catalogservices.ProductListFilter{
		Query:         c.Query("q"),
		SKU:           c.Query("sku"),
		Slug:          c.Query("slug"),
		StockStatus:   c.Query("stock_status"),
		OnlyPublished: true,
		Page:          parseIntParam(c.Query("page"), 1),
		Limit:         parseIntParam(c.Query("limit"), 20),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": products, "total": total})
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
	c.JSON(http.StatusOK, productResponse{Product: *product, CategoryIDs: categoryIDs, TagIDs: tagIDs})
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
