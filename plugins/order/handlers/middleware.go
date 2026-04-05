package handlers

import (
	authhandlers "go_framework/plugins/auth/handlers"

	"github.com/gin-gonic/gin"
)

// RequireOrderAdminJWT is the order-scoped wrapper for admin authentication.
func RequireOrderAdminJWT() gin.HandlerFunc {
	return authhandlers.RequireAdminJWT()
}

// RequireOrderCustomerJWT is the order-scoped wrapper for customer authentication.
func RequireOrderCustomerJWT() gin.HandlerFunc {
	return authhandlers.RequireCustomerJWT()
}
