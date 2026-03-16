package plugin_registry

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// PermissionProvider allows plugins to expose a permission-checking middleware.
type PermissionProvider interface {
	RequirePermission(permission string) gin.HandlerFunc
}

var permissionProvider PermissionProvider

// RegisterPermissionProvider registers the project's permission provider implementation.
func RegisterPermissionProvider(p PermissionProvider) {
	permissionProvider = p
}

// RequirePermission returns a permission-check middleware from the registered provider.
// If no provider is registered it returns a middleware that rejects requests.
func RequirePermission(permission string) gin.HandlerFunc {
	if permissionProvider == nil {
		return func(c *gin.Context) {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "permission provider unavailable"})
			return
		}
	}
	return permissionProvider.RequirePermission(permission)
}
