package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CategoryHandler struct {
	svc *catalogservices.CatalogService
}

func NewCategoryHandler(svc *catalogservices.CatalogService) *CategoryHandler {
	return &CategoryHandler{svc: svc}
}

type createCategoryRequest struct {
	ParentID          *string         `json:"parent_id"`
	Name              string          `json:"name"`
	Slug              string          `json:"slug"`
	Description       *string         `json:"description"`
	DescriptionHTML   *string         `json:"description_html"`
	DescriptionPlain  *string         `json:"description_plain"`
	DescriptionBlocks json.RawMessage `json:"description_blocks"`
	ShortDescription  *string         `json:"short_description"`
	IconURL           *string         `json:"icon_url"`
	SEOContent        json.RawMessage `json:"seo_content"`
	SortPriority      int             `json:"sort_priority"`
}

type upsertCategoryTranslationRequest struct {
	Name              string          `json:"name"`
	Slug              string          `json:"slug"`
	Description       *string         `json:"description"`
	DescriptionHTML   *string         `json:"description_html"`
	DescriptionPlain  *string         `json:"description_plain"`
	DescriptionBlocks json.RawMessage `json:"description_blocks"`
	ShortDescription  *string         `json:"short_description"`
	SEOContent        json.RawMessage `json:"seo_content"`
}

func applyCategoryTranslation(category *catalogmodels.Category, translation catalogmodels.CategoryTranslation) {
	if strings.TrimSpace(translation.Name) != "" {
		category.Name = translation.Name
	}
	if strings.TrimSpace(translation.Slug) != "" {
		category.Slug = translation.Slug
	}
	if translation.Description != nil {
		category.Description = translation.Description
	}
	if translation.DescriptionHTML != nil {
		category.DescriptionHTML = translation.DescriptionHTML
	}
	if translation.DescriptionPlain != nil {
		category.DescriptionPlain = translation.DescriptionPlain
	}
	if len(translation.DescriptionBlocks) > 0 {
		category.DescriptionBlocks = translation.DescriptionBlocks
	}
	if translation.ShortDescription != nil {
		category.ShortDescription = translation.ShortDescription
	}
	if len(translation.SEOContent) > 0 {
		category.SEOContent = translation.SEOContent
	}
}

func (h *CategoryHandler) Create(c *gin.Context) {
	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	// validate seo_content JSON if provided
	var seo json.RawMessage
	if len(req.SEOContent) > 0 {
		normalized, err := normalizeRawJSON(req.SEOContent)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		seo = json.RawMessage(normalized)
	}
	blocks, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item := &catalogmodels.Category{ID: id, ParentID: req.ParentID, Name: req.Name, Slug: req.Slug, Description: req.Description, DescriptionHTML: req.DescriptionHTML, DescriptionPlain: req.DescriptionPlain, DescriptionBlocks: blocks, ShortDescription: req.ShortDescription, IconURL: req.IconURL, SEOContent: seo, SortPriority: req.SortPriority}
	if err := h.svc.CreateCategory(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *CategoryHandler) ListTranslations(c *gin.Context) {
	items, err := h.svc.ListCategoryTranslations(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *CategoryHandler) UpsertTranslation(c *gin.Context) {
	var req upsertCategoryTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Slug) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and slug are required"})
		return
	}
	var seo json.RawMessage
	if len(req.SEOContent) > 0 {
		normalized, err := normalizeRawJSON(req.SEOContent)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		seo = json.RawMessage(normalized)
	}
	blocks, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.UpsertCategoryTranslation(
		c.Request.Context(),
		c.Param("id"),
		c.Param("locale"),
		req.Name,
		req.Slug,
		req.Description,
		req.DescriptionHTML,
		req.DescriptionPlain,
		blocks,
		req.ShortDescription,
		seo,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *CategoryHandler) List(c *gin.Context) {
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 20)
	withDeleted := strings.ToLower(strings.TrimSpace(c.Query("with_deleted"))) == "true"
	parentIDRaw, hasParentFilter := c.GetQuery("parent_id")
	var parentID *string
	if hasParentFilter {
		trimmed := parentIDRaw
		parentID = &trimmed
	}

	items, total, err := h.svc.ListCategories(c.Request.Context(), page, limit, parentID, hasParentFilter, withDeleted)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	locale := strings.TrimSpace(c.Query("locale"))
	if locale != "" {
		ids := make([]string, 0, len(items))
		for _, item := range items {
			ids = append(ids, item.ID)
		}
		translationMap, err := h.svc.GetCategoryTranslationMapByCategoryIDs(c.Request.Context(), ids, locale)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for index := range items {
			if translation, ok := translationMap[items[index].ID]; ok {
				applyCategoryTranslation(&items[index], translation)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *CategoryHandler) Restore(c *gin.Context) {
	affected, err := h.svc.RestoreCategoryByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "category restored"})
}

func (h *CategoryHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetCategoryByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	locale := strings.TrimSpace(c.Query("locale"))
	if locale != "" {
		translationMap, err := h.svc.GetCategoryTranslationMapByCategoryIDs(c.Request.Context(), []string{item.ID}, locale)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if tr, ok := translationMap[item.ID]; ok {
			applyCategoryTranslation(item, tr)
		}
	}
	c.JSON(http.StatusOK, item)
}

func (h *CategoryHandler) Update(c *gin.Context) {
	item, err := h.svc.GetCategoryByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Slug != "" {
		item.Slug = req.Slug
	}
	if req.Description != nil {
		item.Description = req.Description
	}
	if req.DescriptionHTML != nil {
		item.DescriptionHTML = req.DescriptionHTML
	}
	if req.DescriptionPlain != nil {
		item.DescriptionPlain = req.DescriptionPlain
	}
	if len(req.DescriptionBlocks) > 0 {
		normalized, err := normalizeRawJSON(req.DescriptionBlocks)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.DescriptionBlocks = normalized
	}
	if req.ShortDescription != nil {
		item.ShortDescription = req.ShortDescription
	}
	item.ParentID = req.ParentID
	item.IconURL = req.IconURL
	if len(req.SEOContent) > 0 {
		normalized, err := normalizeRawJSON(req.SEOContent)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.SEOContent = json.RawMessage(normalized)
	}
	item.SortPriority = req.SortPriority
	if err := h.svc.UpdateCategory(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteCategoryByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}
