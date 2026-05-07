package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SlugHandler struct {
	svc *catalogservices.CatalogService
}

func NewSlugHandler(svc *catalogservices.CatalogService) *SlugHandler {
	return &SlugHandler{svc: svc}
}

func makeSlugLocal(input string) string {
	s := strings.ToLower(strings.TrimSpace(input))
	// replicate slug rules from services
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			prevDash = false
			continue
		}
		if !prevDash {
			b.WriteRune('-')
			prevDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "product"
	}
	return out
}

// GET /api/catalog/businesses/slug/suggest?name=...&limit=5&current_id=...
func (h *SlugHandler) Suggest(c *gin.Context) {
	name := strings.TrimSpace(c.Query("name"))
	slugParam := strings.TrimSpace(c.Query("slug"))
	currentID := strings.TrimSpace(c.Query("current_id"))
	limit := parseIntParam(c.Query("limit"), 5)
	if limit <= 0 || limit > 20 {
		limit = 5
	}

	if name == "" && slugParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name or slug is required"})
		return
	}

	base := makeSlugLocal(slugParam)
	if slugParam == "" {
		base = makeSlugLocal(name)
	}

	// check base availability
	var count int64
	q := h.svc.DB.WithContext(c.Request.Context()).Model(&catalogmodels.Business{}).Where("slug = ?", base)
	if currentID != "" {
		q = q.Where("id <> ?", currentID)
	}
	if err := q.Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	available := count == 0
	suggestions := []string{}
	note := "generated"
	if available {
		suggestions = append(suggestions, base)
		// optionally generate a few alternates as well
		for i := 0; len(suggestions) < limit; i++ {
			candidate := fmt.Sprintf("%s-%d", base, i+2)
			var cc int64
			qq := h.svc.DB.WithContext(c.Request.Context()).Model(&catalogmodels.Business{}).Where("slug = ?", candidate)
			if currentID != "" {
				qq = qq.Where("id <> ?", currentID)
			}
			if err := qq.Count(&cc).Error; err != nil {
				break
			}
			if cc == 0 {
				suggestions = append(suggestions, candidate)
			}
		}
		note = "base-available"
	} else {
		// base taken -> generate alternatives
		for i := 0; len(suggestions) < limit && i < 100; i++ {
			candidate := fmt.Sprintf("%s-%d", base, i+2)
			var cc int64
			qq := h.svc.DB.WithContext(c.Request.Context()).Model(&catalogmodels.Business{}).Where("slug = ?", candidate)
			if currentID != "" {
				qq = qq.Where("id <> ?", currentID)
			}
			if err := qq.Count(&cc).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if cc == 0 {
				suggestions = append(suggestions, candidate)
			}
		}
		note = "base-taken"
	}

	c.JSON(http.StatusOK, gin.H{
		"slug":        base,
		"available":   available,
		"suggestions": suggestions,
		"note":        note,
	})
}

// GET /api/catalog/businesses/slug/check?slug=...&current_id=...
func (h *SlugHandler) Check(c *gin.Context) {
	slugParam := strings.TrimSpace(c.Query("slug"))
	currentID := strings.TrimSpace(c.Query("current_id"))
	if slugParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slug is required"})
		return
	}
	norm := makeSlugLocal(slugParam)

	var count int64
	q := h.svc.DB.WithContext(c.Request.Context()).Model(&catalogmodels.Business{}).Where("slug = ?", norm)
	if currentID != "" {
		q = q.Where("id <> ?", currentID)
	}
	if err := q.Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if count == 0 {
		c.JSON(http.StatusOK, gin.H{"slug": norm, "available": true})
		return
	}

	var existing catalogmodels.Business
	if err := h.svc.DB.WithContext(c.Request.Context()).Where("slug = ?", norm).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"slug": norm, "available": true})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"slug": norm, "available": false, "conflict_id": existing.ID})
}
