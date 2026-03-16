package handlers

import (
	"net/http"

	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
)

type SearchHandler struct {
	svc *catalogservices.CatalogService
}

func NewSearchHandler(svc *catalogservices.CatalogService) *SearchHandler {
	return &SearchHandler{svc: svc}
}

func (h *SearchHandler) Search(c *gin.Context) {
	isVisible, err := parseBoolParam(c.Query("is_visible"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid is_visible value"})
		return
	}

	products, total, facets, err := h.svc.SearchProductsWithFacets(c.Request.Context(), catalogservices.ProductListFilter{
		Query:       c.Query("q"),
		SKU:         c.Query("sku"),
		Slug:        c.Query("slug"),
		Status:      c.Query("status"),
		StockStatus: c.Query("stock_status"),
		IsVisible:   isVisible,
		Page:        parseIntParam(c.Query("page"), 1),
		Limit:       parseIntParam(c.Query("limit"), 20),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": products, "total": total, "facets": facets})
}

func (h *SearchHandler) PublicSearch(c *gin.Context) {
	products, total, facets, err := h.svc.SearchProductsWithFacets(c.Request.Context(), catalogservices.ProductListFilter{
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
	c.JSON(http.StatusOK, gin.H{"data": products, "total": total, "facets": facets})
}
