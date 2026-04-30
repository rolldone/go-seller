package handlers

import (
	authhandlers "go_framework/plugins/auth/handlers"
	authservices "go_framework/plugins/auth/services"
	"go_framework/plugins/payment_gateway/pgwtypes"
	"go_framework/plugins/payment_gateway/services"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(
	authSvc *authservices.AuthService,
	logSvc *services.LogService,
	admin *gin.RouterGroup,
	api *gin.RouterGroup,
	getGateway func(key string) (pgwtypes.PaymentGateway, bool),
) {
	if admin == nil {
		return
	}

	// Admin routes: super admin only
	adminGateway := admin.Group("/payment-gateways")
	adminGateway.Use(authhandlers.RequireAdminJWT(), RequireSuperAdmin(authSvc))

	gatewayHandler := NewGatewayHandler()
	adminGateway.GET("", gatewayHandler.List)
	adminGateway.POST("", gatewayHandler.Create)
	adminGateway.PUT(":id", gatewayHandler.Update)
	adminGateway.POST(":id/activate", gatewayHandler.Activate)
	adminGateway.POST(":id/deactivate", gatewayHandler.Deactivate)
	adminGateway.POST("/validate", gatewayHandler.Validate)

	logHandler := NewLogHandler(logSvc)
	adminGateway.GET("/logs", logHandler.List)

	// Public webhook routes: called by payment gateway providers (no JWT).
	// Signature verification is handled inside each gateway's HandleCallback.
	if api != nil {
		webhookHandler := NewWebhookHandler(getGateway, logSvc)
		apiGateway := api.Group("/payment-gateway")
		apiGateway.POST("/webhook/:provider_key", webhookHandler.Handle)
	}
}
