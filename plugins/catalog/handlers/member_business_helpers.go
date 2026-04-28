package handlers

import (
	"errors"
	"net/http"
	"strings"

	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func requireMemberBusinessAccess(c *gin.Context, svc *catalogservices.CatalogService, businessID string) bool {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return false
	}
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return false
	}
	if _, err := svc.GetBusinessByIDForMember(c.Request.Context(), memberID, trimmedBusinessID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	return true
}

func requireMemberBusinessOwnerAccess(c *gin.Context, svc *catalogservices.CatalogService, businessID string) bool {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return false
	}
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return false
	}
	if _, err := svc.GetBusinessByIDForMemberOwner(c.Request.Context(), memberID, trimmedBusinessID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	return true
}
