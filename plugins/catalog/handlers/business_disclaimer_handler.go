package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BusinessDisclaimerHandler struct {
	svc *catalogservices.CatalogService
}

func NewBusinessDisclaimerHandler(svc *catalogservices.CatalogService) *BusinessDisclaimerHandler {
	return &BusinessDisclaimerHandler{svc: svc}
}

type createDisclaimerRequest struct {
	Title        *string         `json:"title"`
	ContentHTML  *string         `json:"content_html"`
	ContentPlain *string         `json:"content_plain"`
	IconKey      *string         `json:"icon_key"`
	SortOrder    *int            `json:"sort_order"`
	IsActive     *bool           `json:"is_active"`
	Metadata     json.RawMessage `json:"metadata"`
}

type upsertBusinessDisclaimerRequest struct {
	Title        *string         `json:"title"`
	ContentHTML  *string         `json:"content_html"`
	ContentPlain *string         `json:"content_plain"`
	IconKey      *string         `json:"icon_key"`
	SortOrder    *int            `json:"sort_order"`
	IsActive     *bool           `json:"is_active"`
	Metadata     json.RawMessage `json:"metadata"`
}

type upsertBusinessDisclaimerTranslationRequest struct {
	Title        *string `json:"title"`
	ContentHTML  *string `json:"content_html"`
	ContentPlain *string `json:"content_plain"`
}

func (h *BusinessDisclaimerHandler) Create(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	var req createDisclaimerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	metadataJSON, err := normalizeRawJSON(req.Metadata)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	d := &catalogmodels.BusinessDisclaimer{
		ID:           id,
		BusinessID:   businessID,
		Title:        req.Title,
		ContentHTML:  req.ContentHTML,
		ContentPlain: req.ContentPlain,
		IconKey:      req.IconKey,
		Metadata:     metadataJSON,
	}
	if req.SortOrder != nil {
		d.SortOrder = *req.SortOrder
	}
	if req.IsActive != nil {
		d.IsActive = *req.IsActive
	} else {
		d.IsActive = true
	}

	if err := h.svc.CreateBusinessDisclaimer(c.Request.Context(), d); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *BusinessDisclaimerHandler) List(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 50)

	items, total, err := h.svc.ListBusinessDisclaimers(c.Request.Context(), businessID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *BusinessDisclaimerHandler) GetByID(c *gin.Context) {
	id := strings.TrimSpace(c.Param("disclaimer_id"))
	item, err := h.svc.GetBusinessDisclaimerByID(c.Request.Context(), id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "disclaimer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessDisclaimerHandler) Update(c *gin.Context) {
	id := strings.TrimSpace(c.Param("disclaimer_id"))
	item, err := h.svc.GetBusinessDisclaimerByID(c.Request.Context(), id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "disclaimer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var req upsertBusinessDisclaimerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title != nil {
		item.Title = req.Title
	}
	if req.ContentHTML != nil {
		item.ContentHTML = req.ContentHTML
	}
	if req.ContentPlain != nil {
		item.ContentPlain = req.ContentPlain
	}
	if req.IconKey != nil {
		v := strings.TrimSpace(*req.IconKey)
		item.IconKey = &v
	}
	if req.SortOrder != nil {
		item.SortOrder = *req.SortOrder
	}
	if req.IsActive != nil {
		item.IsActive = *req.IsActive
	}
	if len(req.Metadata) > 0 {
		metadataJSON, err := normalizeRawJSON(req.Metadata)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.Metadata = metadataJSON
	}

	if err := h.svc.UpdateBusinessDisclaimer(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessDisclaimerHandler) Delete(c *gin.Context) {
	id := strings.TrimSpace(c.Param("disclaimer_id"))
	affected, err := h.svc.DeleteBusinessDisclaimerByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "disclaimer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

func (h *BusinessDisclaimerHandler) PublicList(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	locale := strings.TrimSpace(c.Query("locale"))
	items, err := h.svc.GetActiveDisclaimersForBusiness(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(items) > 0 {
		itemIDs := make([]string, 0, len(items))
		for _, item := range items {
			itemIDs = append(itemIDs, item.ID)
		}
		translations, err := h.svc.GetBusinessDisclaimerTranslationMapByDisclaimerIDs(c.Request.Context(), itemIDs, locale)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for index := range items {
			if translation, ok := translations[items[index].ID]; ok {
				applyBusinessDisclaimerTranslation(&items[index], translation)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func applyBusinessDisclaimerTranslation(disclaimer *catalogmodels.BusinessDisclaimer, translation catalogmodels.BusinessDisclaimerTranslation) {
	if translation.Title != nil {
		disclaimer.Title = translation.Title
	}
	if translation.ContentHTML != nil {
		disclaimer.ContentHTML = translation.ContentHTML
	}
	if translation.ContentPlain != nil {
		disclaimer.ContentPlain = translation.ContentPlain
	}
}

func (h *BusinessDisclaimerHandler) ListTranslations(c *gin.Context) {
	disclaimerID := strings.TrimSpace(c.Param("disclaimer_id"))
	items, err := h.svc.ListBusinessDisclaimerTranslations(c.Request.Context(), disclaimerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BusinessDisclaimerHandler) UpsertTranslation(c *gin.Context) {
	disclaimerID := strings.TrimSpace(c.Param("disclaimer_id"))
	locale := strings.TrimSpace(c.Param("locale"))
	var req upsertBusinessDisclaimerTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.UpsertBusinessDisclaimerTranslation(
		c.Request.Context(),
		disclaimerID,
		locale,
		req.Title,
		req.ContentHTML,
		req.ContentPlain,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}
