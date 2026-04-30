package handlers

import (
	"net/http"
	"strings"

	internalauth "go_framework/internal/auth"
	authservices "go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
)

func RequireSuperAdmin(svc *authservices.AuthService) gin.HandlerFunc {
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
			c.Set("admin_id", adminID)
			c.Set("admin_level", claims.Level)
		}

		admin, err := svc.GetAdminByID(c.Request.Context(), adminID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to load admin profile"})
			return
		}
		if !admin.IsSuperAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "super admin access required"})
			return
		}

		c.Next()
	}
}
