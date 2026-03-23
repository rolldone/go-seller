package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type BusinessHandler struct {
	svc *catalogservices.CatalogService
}

type businessRequest struct {
	Name              string          `json:"name"`
	Slug              string          `json:"slug"`
	Description       *string         `json:"description"`
	ShortDescription  *string         `json:"short_description"`
	DescriptionHTML   *string         `json:"description_html"`
	DescriptionPlain  *string         `json:"description_plain"`
	DescriptionBlocks json.RawMessage `json:"description_blocks"`
	Highlights        json.RawMessage `json:"highlights"`
	OwnerName         *string         `json:"owner_name"`
	OwnerRole         *string         `json:"owner_role"`
	FoundedYear       *int            `json:"founded_year"`
	Address           *string         `json:"address"`
	OperationalHours  json.RawMessage `json:"operational_hours"`
	ChatResponseTime  *string         `json:"chat_response_time"`
	Email             *string         `json:"email"`
	Phone             *string         `json:"phone"`
	ShowContactEmail  *bool           `json:"show_contact_email"`
	ShowPhone         *bool           `json:"show_phone"`
}

func NewBusinessHandler(svc *catalogservices.CatalogService) *BusinessHandler {
	return &BusinessHandler{svc: svc}
}

func (h *BusinessHandler) Create(c *gin.Context) {
	var req businessRequest
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
	highlightsJSON, err := normalizeRawJSON(req.Highlights)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	operationalJSON, err := normalizeRawJSON(req.OperationalHours)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	showEmail := true
	if req.ShowContactEmail != nil {
		showEmail = *req.ShowContactEmail
	}
	showPhone := true
	if req.ShowPhone != nil {
		showPhone = *req.ShowPhone
	}
	item := &catalogmodels.Business{
		ID:                id,
		Name:              req.Name,
		Slug:              req.Slug,
		Description:       req.Description,
		ShortDescription:  req.ShortDescription,
		DescriptionHTML:   req.DescriptionHTML,
		DescriptionPlain:  req.DescriptionPlain,
		DescriptionBlocks: blocksJSON,
		Highlights:        highlightsJSON,
		OwnerName:         req.OwnerName,
		OwnerRole:         req.OwnerRole,
		FoundedYear:       req.FoundedYear,
		Address:           req.Address,
		OperationalHours:  operationalJSON,
		ChatResponseTime:  req.ChatResponseTime,
		Email:             req.Email,
		Phone:             req.Phone,
		ShowContactEmail:  showEmail,
		ShowPhone:         showPhone,
	}
	if err := h.svc.CreateBusiness(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *BusinessHandler) List(c *gin.Context) {
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 20)

	items, total, err := h.svc.ListBusinesses(c.Request.Context(), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *BusinessHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetBusinessByID(c.Request.Context(), c.Param("business_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessHandler) Update(c *gin.Context) {
	item, err := h.svc.GetBusinessByID(c.Request.Context(), c.Param("business_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var req businessRequest
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
	item.Description = req.Description
	if req.ShortDescription != nil {
		item.ShortDescription = req.ShortDescription
	}
	if req.DescriptionHTML != nil {
		item.DescriptionHTML = req.DescriptionHTML
	}
	if req.DescriptionPlain != nil {
		item.DescriptionPlain = req.DescriptionPlain
	}
	if len(req.DescriptionBlocks) > 0 {
		blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.DescriptionBlocks = blocksJSON
	}
	if len(req.Highlights) > 0 {
		highlightsJSON, err := normalizeRawJSON(req.Highlights)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.Highlights = highlightsJSON
	}
	if req.OwnerName != nil {
		item.OwnerName = req.OwnerName
	}
	if req.OwnerRole != nil {
		item.OwnerRole = req.OwnerRole
	}
	if req.FoundedYear != nil {
		item.FoundedYear = req.FoundedYear
	}
	if req.Address != nil {
		item.Address = req.Address
	}
	if len(req.OperationalHours) > 0 {
		operationalJSON, err := normalizeRawJSON(req.OperationalHours)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.OperationalHours = operationalJSON
	}
	if req.ChatResponseTime != nil {
		item.ChatResponseTime = req.ChatResponseTime
	}
	if req.Email != nil {
		item.Email = req.Email
	}
	if req.Phone != nil {
		item.Phone = req.Phone
	}
	if req.ShowContactEmail != nil {
		item.ShowContactEmail = *req.ShowContactEmail
	}
	if req.ShowPhone != nil {
		item.ShowPhone = *req.ShowPhone
	}
	if err := h.svc.UpdateBusiness(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteBusinessByID(c.Request.Context(), c.Param("business_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

// PublicGetBySlug returns business data by slug for public usage (used by /b/:slug)
func (h *BusinessHandler) PublicGetBySlug(c *gin.Context) {
	slug := c.Param("slug")
	item, err := h.svc.GetBusinessBySlug(c.Request.Context(), slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// assets are preloaded by service; ensure public_url is absolute
	base := strings.TrimRight(os.Getenv("APP_URL"), "/")
	for i := range item.Assets {
		if item.Assets[i].PublicURL != "" && strings.HasPrefix(item.Assets[i].PublicURL, "/") {
			item.Assets[i].PublicURL = base + item.Assets[i].PublicURL
			continue
		}
		if item.Assets[i].FilePath != "" && item.Assets[i].PublicURL == "" {
			if full, err := h.svc.Store.PublicURL(c.Request.Context(), item.Assets[i].FilePath); err == nil {
				item.Assets[i].PublicURL = full
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": item, "assets": item.Assets})
}

func normalizeRawJSON(raw json.RawMessage) (datatypes.JSON, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, nil
	}
	trimmed := bytes.TrimSpace(raw)
	if !json.Valid(trimmed) {
		return nil, fmt.Errorf("invalid JSON payload")
	}
	return datatypes.JSON(trimmed), nil
}
