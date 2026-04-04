package plugin_registry

import (
	"net/http"

	"context"

	"github.com/gin-gonic/gin"

	"gorm.io/gorm"
)

// ─── Permission provider ─────────────────────────────────────────────────────

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
		}
	}
	return permissionProvider.RequirePermission(permission)
}

// ─── Notification provider ──────────────────────────────────────────────────

// NotificationProvider allows a plugin to handle notification dispatching so
// core code can call into the registered plugin without depending on its
// concrete implementation.
type NotificationProvider interface {
	SendOrderEvent(ctx context.Context, db *gorm.DB, eventKey string, orderID string) error
	SendOrderEventAsync(ctx context.Context, db *gorm.DB, eventKey string, orderID string)
	SendTemplateEvent(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) error
	SendTemplateEventAsync(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{})
}

var notificationProvider NotificationProvider

// RegisterNotificationProvider registers a notification provider implementation.
func RegisterNotificationProvider(p NotificationProvider) {
	notificationProvider = p
}

// SendOrderEvent delegates to the registered provider if available.
func SendOrderEvent(ctx context.Context, db *gorm.DB, eventKey string, orderID string) error {
	if notificationProvider == nil {
		return nil
	}
	return notificationProvider.SendOrderEvent(ctx, db, eventKey, orderID)
}

// SendOrderEventAsync delegates to the registered provider if available.
func SendOrderEventAsync(ctx context.Context, db *gorm.DB, eventKey string, orderID string) {
	if notificationProvider == nil {
		return
	}
	notificationProvider.SendOrderEventAsync(ctx, db, eventKey, orderID)
}

// SendTemplateEvent delegates template-based notification dispatching to the registered provider.
func SendTemplateEvent(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) error {
	if notificationProvider == nil {
		return nil
	}
	return notificationProvider.SendTemplateEvent(ctx, db, eventKey, payload)
}

// SendTemplateEventAsync delegates template-based notification dispatching to the registered provider.
func SendTemplateEventAsync(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) {
	if notificationProvider == nil {
		return
	}
	notificationProvider.SendTemplateEventAsync(ctx, db, eventKey, payload)
}
