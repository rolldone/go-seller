package handlers

import (
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
	ParentID     *string `json:"parent_id"`
	Name         string  `json:"name"`
	Slug         string  `json:"slug"`
	IconURL      *string `json:"icon_url"`
	SortPriority int     `json:"sort_priority"`
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
	item := &catalogmodels.Category{ID: id, ParentID: req.ParentID, Name: req.Name, Slug: req.Slug, IconURL: req.IconURL, SortPriority: req.SortPriority}
	if err := h.svc.CreateCategory(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
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
	item.ParentID = req.ParentID
	item.IconURL = req.IconURL
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
