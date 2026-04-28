package handlers

import (
	"errors"
	"net/http"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"
	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func memberIDFromContext(c *gin.Context) (string, bool) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		return "", false
	}
	return memberID, true
}

func memberBusinessAccess(c *gin.Context, catalogSvc *catalogservices.CatalogService, businessID string) (*catalogmodels.Business, bool) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return nil, false
	}
	if catalogSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "catalog service not configured"})
		return nil, false
	}
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return nil, false
	}
	business, err := catalogSvc.GetBusinessByIDForMemberAccess(c.Request.Context(), memberID, trimmedBusinessID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return nil, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return nil, false
	}
	return business, true
}

func memberOrderAccess(c *gin.Context, orderSvc *ordersvc.OrderService, catalogSvc *catalogservices.CatalogService, businessID, orderID string) (*ordermodels.Order, bool) {
	if orderSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "order service not configured"})
		return nil, false
	}
	order, err := orderSvc.GetOrderByID(c.Request.Context(), strings.TrimSpace(orderID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return nil, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return nil, false
	}
	if order.BusinessID == nil || strings.TrimSpace(*order.BusinessID) == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return nil, false
	}
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID != "" && trimmedBusinessID != strings.TrimSpace(*order.BusinessID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return nil, false
	}
	if _, ok := memberBusinessAccess(c, catalogSvc, *order.BusinessID); !ok {
		return nil, false
	}
	return order, true
}
