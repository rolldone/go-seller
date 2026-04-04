package handlers

import (
	"net/http"
	"strings"

	internalauth "go_framework/internal/auth"
	authservices "go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
)

func RequireAdminJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		authz := strings.TrimSpace(c.GetHeader("Authorization"))
		if !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}

		token := strings.TrimSpace(authz[len("Bearer "):])
		claims, err := internalauth.ParseAccessTokenClaims(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		if claims.Level != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient access level"})
			return
		}

		c.Set("admin_id", claims.AdminID)
		c.Set("admin_level", claims.Level)
		c.Next()
	}
}

func RequireCustomerJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		authz := strings.TrimSpace(c.GetHeader("Authorization"))
		if !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}

		token := strings.TrimSpace(authz[len("Bearer "):])
		claims, err := internalauth.ParseAccessTokenClaims(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		if claims.Level != "customer" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient access level"})
			return
		}

		c.Set("customer_id", claims.AdminID)
		c.Set("customer_level", claims.Level)
		c.Next()
	}
}

// RequirePermission enforces granular permission checks for admin routes.
// It expects admin identity from RequireAdminJWT and falls back to token parsing.
func RequirePermission(svc *authservices.AuthService, permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if svc == nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "authorization service unavailable"})
			return
		}

		adminID := strings.TrimSpace(c.GetString("admin_id"))
		if adminID == "" {
			authz := strings.TrimSpace(c.GetHeader("Authorization"))
			if !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
				return
			}
			token := strings.TrimSpace(authz[len("Bearer "):])
			claims, err := internalauth.ParseAccessTokenClaims(token)
			if err != nil || claims.Level != "admin" {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
				return
			}
			adminID = claims.AdminID
			c.Set("admin_id", claims.AdminID)
			c.Set("admin_level", claims.Level)
		}

		var scopeBusinessID *string
		if v := strings.TrimSpace(c.Query("business_id")); v != "" {
			scopeBusinessID = &v
		} else if v := strings.TrimSpace(c.Param("business_id")); v != "" {
			scopeBusinessID = &v
		}

		allowed, err := svc.HasPermission(c.Request.Context(), adminID, permission, scopeBusinessID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve permissions"})
			return
		}
		if !allowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}

		c.Next()
	}
}
