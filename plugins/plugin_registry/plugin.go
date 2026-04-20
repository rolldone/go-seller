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

// ─── Search index provider ───────────────────────────────────────────────────

// SearchIndexerProvider allows plugins to keep the search index in sync from
// application-level hooks instead of database triggers.
type SearchIndexerProvider interface {
	UpsertProduct(ctx context.Context, db *gorm.DB, productID string) error
	DeleteProduct(ctx context.Context, db *gorm.DB, productID string) error
	UpsertBusiness(ctx context.Context, db *gorm.DB, businessID string) error
	DeleteBusiness(ctx context.Context, db *gorm.DB, businessID string) error
	UpsertCategory(ctx context.Context, db *gorm.DB, categoryID string) error
	DeleteCategory(ctx context.Context, db *gorm.DB, categoryID string) error
}

var searchIndexerProvider SearchIndexerProvider

// RegisterSearchIndexerProvider registers a search index provider implementation.
func RegisterSearchIndexerProvider(p SearchIndexerProvider) {
	searchIndexerProvider = p
}

// SearchIndexUpsertProduct delegates product indexing to the registered provider.
func SearchIndexUpsertProduct(ctx context.Context, db *gorm.DB, productID string) error {
	if searchIndexerProvider == nil {
		return nil
	}
	return searchIndexerProvider.UpsertProduct(ctx, db, productID)
}

// SearchIndexDeleteProduct delegates product removal from the search index.
func SearchIndexDeleteProduct(ctx context.Context, db *gorm.DB, productID string) error {
	if searchIndexerProvider == nil {
		return nil
	}
	return searchIndexerProvider.DeleteProduct(ctx, db, productID)
}

// SearchIndexUpsertBusiness delegates business indexing to the registered provider.
func SearchIndexUpsertBusiness(ctx context.Context, db *gorm.DB, businessID string) error {
	if searchIndexerProvider == nil {
		return nil
	}
	return searchIndexerProvider.UpsertBusiness(ctx, db, businessID)
}

// SearchIndexDeleteBusiness delegates business removal from the search index.
func SearchIndexDeleteBusiness(ctx context.Context, db *gorm.DB, businessID string) error {
	if searchIndexerProvider == nil {
		return nil
	}
	return searchIndexerProvider.DeleteBusiness(ctx, db, businessID)
}

// SearchIndexUpsertCategory delegates category indexing to the registered provider.
func SearchIndexUpsertCategory(ctx context.Context, db *gorm.DB, categoryID string) error {
	if searchIndexerProvider == nil {
		return nil
	}
	return searchIndexerProvider.UpsertCategory(ctx, db, categoryID)
}

// SearchIndexDeleteCategory delegates category removal from the search index.
func SearchIndexDeleteCategory(ctx context.Context, db *gorm.DB, categoryID string) error {
	if searchIndexerProvider == nil {
		return nil
	}
	return searchIndexerProvider.DeleteCategory(ctx, db, categoryID)
}
