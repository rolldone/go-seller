package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"go_framework/plugins/catalog/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type upsertBusinessTranslationRequest struct {
	ShortDescription *string         `json:"short_description"`
	Highlights       json.RawMessage `json:"highlights"`
	StoryHTML        *string         `json:"story_html"`
	StoryPlain       *string         `json:"story_plain"`
	StoryBlocks      json.RawMessage `json:"story_blocks"`
}

func applyBusinessTranslation(business *models.Business, translation models.BusinessTranslation) {
	if translation.ShortDescription != nil {
		business.ShortDescription = translation.ShortDescription
	}
	if translation.Highlights != nil {
		business.Highlights = translation.Highlights
	}
	if translation.StoryHTML != nil {
		business.DescriptionHTML = translation.StoryHTML
	}
	if translation.StoryPlain != nil {
		business.DescriptionPlain = translation.StoryPlain
		business.Description = translation.StoryPlain
	}
	if translation.StoryBlocks != nil {
		business.DescriptionBlocks = translation.StoryBlocks
	}
}

func (h *BusinessHandler) ListTranslations(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	items, err := h.svc.ListBusinessTranslations(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BusinessHandler) UpsertTranslation(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	locale := strings.TrimSpace(c.Param("locale"))
	var req upsertBusinessTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	highlightsJSON, err := normalizeRawJSON(req.Highlights)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	storyBlocksJSON, err := normalizeRawJSON(req.StoryBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.UpsertBusinessTranslation(
		c.Request.Context(),
		businessID,
		locale,
		req.ShortDescription,
		highlightsJSON,
		req.StoryHTML,
		req.StoryPlain,
		storyBlocksJSON,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessHandler) MemberListTranslations(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	businessID := strings.TrimSpace(c.Param("business_id"))
	if _, err := h.svc.GetBusinessByIDForMember(c.Request.Context(), memberID, businessID); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	items, err := h.svc.ListBusinessTranslations(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BusinessHandler) MemberUpsertTranslation(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	businessID := strings.TrimSpace(c.Param("business_id"))
	if _, err := h.svc.GetBusinessByIDForMember(c.Request.Context(), memberID, businessID); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	locale := strings.TrimSpace(c.Param("locale"))
	var req upsertBusinessTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	highlightsJSON, err := normalizeRawJSON(req.Highlights)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	storyBlocksJSON, err := normalizeRawJSON(req.StoryBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.UpsertBusinessTranslation(
		c.Request.Context(),
		businessID,
		locale,
		req.ShortDescription,
		highlightsJSON,
		req.StoryHTML,
		req.StoryPlain,
		storyBlocksJSON,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}
