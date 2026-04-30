package handlers

import (
	"net/http"
	"strconv"

	"go_framework/plugins/payment_gateway/services"

	"github.com/gin-gonic/gin"
)

// LogHandler serves admin endpoints for querying transaction logs.
type LogHandler struct {
	logSvc *services.LogService
}

// NewLogHandler creates a LogHandler.
func NewLogHandler(logSvc *services.LogService) *LogHandler {
	return &LogHandler{logSvc: logSvc}
}

// List handles GET /admin/payment-gateways/logs
// Query params: provider_key, direction, event_type, reference_id, page, per_page
func (h *LogHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))

	filter := services.LogListFilter{
		ProviderKey: c.Query("provider_key"),
		Direction:   c.Query("direction"),
		EventType:   c.Query("event_type"),
		ReferenceID: c.Query("reference_id"),
		Page:        page,
		PerPage:     perPage,
	}

	logs, total, err := h.logSvc.List(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     logs,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}
