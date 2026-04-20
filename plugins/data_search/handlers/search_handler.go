package handlers

import (
	"net/http"
	"strconv"
	"strings"

	dsservices "go_framework/plugins/data_search/services"

	"github.com/gin-gonic/gin"
)

// SearchHandler serves the public full-text search endpoint.
type SearchHandler struct {
	svc *dsservices.SearchService
}

// NewSearchHandler returns a new SearchHandler.
func NewSearchHandler(svc *dsservices.SearchService) *SearchHandler {
	return &SearchHandler{svc: svc}
}

// Search godoc
//
//	GET /api/search?q=...&type=product,business,category&business_id=...&limit=20&offset=0
func (h *SearchHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q is required"})
		return
	}

	var types []string
	if t := c.Query("type"); t != "" {
		for _, v := range strings.Split(t, ",") {
			v = strings.TrimSpace(v)
			if v != "" {
				types = append(types, v)
			}
		}
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	f := dsservices.SearchFilter{
		Query:      q,
		Types:      types,
		BusinessID: c.Query("business_id"),
		Limit:      limit,
		Offset:     offset,
	}

	results, total, err := h.svc.Search(c.Request.Context(), f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   results,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
