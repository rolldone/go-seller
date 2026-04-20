package handlers

import (
	"net/http"
	"strings"

	dsservices "go_framework/plugins/data_search/services"

	"github.com/gin-gonic/gin"
)

// ReindexHandler handles manual rebuilds of the search index.
type ReindexHandler struct {
	svc *dsservices.SearchService
}

// NewReindexHandler returns a new ReindexHandler.
func NewReindexHandler(svc *dsservices.SearchService) *ReindexHandler {
	return &ReindexHandler{svc: svc}
}

type reindexRequest struct {
	Scope string `json:"scope"`
	ID    string `json:"id"`
}

// Reindex rebuilds the search index.
//
// POST /admin/plugins/data_search/reindex
// Body/query:
//
//	scope=all|product|business|category
//	id=<optional single entity id>
func (h *ReindexHandler) Reindex(c *gin.Context) {
	var req reindexRequest
	_ = c.ShouldBindJSON(&req)

	scope := strings.ToLower(strings.TrimSpace(firstNonEmpty(req.Scope, c.Query("scope"), c.PostForm("scope"), "all")))
	id := strings.TrimSpace(firstNonEmpty(req.ID, c.Query("id"), c.PostForm("id")))
	if scope == "all" && id != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id cannot be used with scope=all"})
		return
	}

	var err error
	switch {
	case scope == "all" && id == "":
		err = h.svc.ReindexAll(c.Request.Context(), h.svc.DB)
	case id != "":
		err = h.svc.ReindexOne(c.Request.Context(), h.svc.DB, scope, id)
	default:
		err = h.svc.ReindexScope(c.Request.Context(), h.svc.DB, scope)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "search index rebuilt",
		"scope":   scope,
		"id":      id,
	})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
