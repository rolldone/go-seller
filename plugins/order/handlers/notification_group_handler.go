package handlers

import (
	"net/http"
	"strconv"

	pluginservices "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

type NotificationGroupHandler struct {
	svc *pluginservices.NotificationGroupService
}

func NewNotificationGroupHandler(svc *pluginservices.NotificationGroupService) *NotificationGroupHandler {
	return &NotificationGroupHandler{svc: svc}
}

// ListGroups GET /member/order/notification-groups?business_id=xxx
func (h *NotificationGroupHandler) ListGroups(c *gin.Context) {
	businessID := c.Param("business_id")
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}

	groups, err := h.svc.ListGroups(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": groups})
}

// CreateGroup POST /member/businesses/:business_id/notification-groups
func (h *NotificationGroupHandler) CreateGroup(c *gin.Context) {
	businessID := c.Param("business_id")
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}

	var in pluginservices.CreateNotificationGroupInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	g, err := h.svc.CreateGroup(c.Request.Context(), businessID, in)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": g})
}

// UpdateGroup PUT /member/businesses/:business_id/notification-groups/:id
func (h *NotificationGroupHandler) UpdateGroup(c *gin.Context) {
	businessID := c.Param("business_id")
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var in pluginservices.UpdateNotificationGroupInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	g, err := h.svc.UpdateGroup(c.Request.Context(), id, businessID, in)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": g})
}

// DeleteGroup DELETE /member/businesses/:business_id/notification-groups/:id
func (h *NotificationGroupHandler) DeleteGroup(c *gin.Context) {
	businessID := c.Param("business_id")
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.svc.DeleteGroup(c.Request.Context(), id, businessID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ListValidEvents GET /member/order/notification-groups/events
func (h *NotificationGroupHandler) ListValidEvents(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": pluginservices.ValidNotificationEvents})
}
