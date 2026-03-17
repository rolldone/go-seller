package handlers

import (
	authhandlers "go_framework/plugins/auth/handlers"
	authservices "go_framework/plugins/auth/services"
	"go_framework/plugins/order/services"
	pluginregistry "go_framework/plugins/plugin_registry"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(s *services.Services, authSvc *authservices.AuthService, admin *gin.RouterGroup, api *gin.RouterGroup) {
	if s == nil {
		return
	}

	// admin subgroup for order
	adminOrder := admin.Group("/order")
	// require admin JWT for all order admin routes
	adminOrder.Use(authhandlers.RequireAdminJWT())
	adminOrder.GET("/health", HealthHandler)

	// cart handlers
	cartHandler := NewCartHandler(s.Cart, s.Order)
	adminCart := adminOrder.Group("/carts")
	adminCart.POST("", cartHandler.Create)
	adminCart.POST("/:id/items", cartHandler.AddItem)
	adminCart.GET("/:id", cartHandler.Get)
	adminCart.POST("/:id/checkout", cartHandler.Checkout)

	// wishlist handlers
	wishlistHandler := NewWishlistHandler(s.Wishlist)
	adminWishlist := adminOrder.Group("/wishlists")
	adminWishlist.POST("", wishlistHandler.Create)
	adminWishlist.POST("/:id/items", wishlistHandler.AddItem)
	adminWishlist.GET("/:id", wishlistHandler.Get)

	// payment handlers
	paymentHandler := NewPaymentHandler(s.Payment)
	adminPayment := adminOrder.Group("/payments")
	adminPayment.POST("", paymentHandler.Create)
	adminPayment.POST("/:id/status", paymentHandler.UpdateStatus)

	// order handlers (admin)
	orderHandler := NewOrderHandler(s.Order)
	// require permission: view orders
	adminOrder.GET("/orders", pluginregistry.RequirePermission("orders.view"), orderHandler.AdminList)
	adminOrder.GET("/orders/:id", pluginregistry.RequirePermission("orders.view"), orderHandler.GetByID)
	// create/manage orders
	adminOrder.POST("/orders", pluginregistry.RequirePermission("orders.manage"), orderHandler.AdminCreate)
	adminOrder.POST("/orders/:id/items", pluginregistry.RequirePermission("orders.manage"), orderHandler.AddItem)
	adminOrder.DELETE("/orders/:id/items/:item_id", pluginregistry.RequirePermission("orders.manage"), orderHandler.DeleteItem)
	adminOrder.POST("/orders/:id/items/:item_id/discount", pluginregistry.RequirePermission("orders.manage"), orderHandler.ApplyItemDiscount)
	adminOrder.DELETE("/orders/:id/items/:item_id/discount", pluginregistry.RequirePermission("orders.manage"), orderHandler.RemoveItemDiscount)
	adminOrder.POST("/orders/:id/finalize", pluginregistry.RequirePermission("orders.manage"), orderHandler.Finalize)
	adminOrder.POST("/orders/:id/coupon", pluginregistry.RequirePermission("orders.manage"), orderHandler.ApplyCoupon)
	adminOrder.DELETE("/orders/:id/coupon/:code", pluginregistry.RequirePermission("orders.manage"), orderHandler.RemoveCoupon)

	// Server-to-server callback endpoint — payload is AES-GCM encrypted with shared S2S_KEY.
	callbackHandler := NewCallbackHandler(s.Order)
	apiOrder := api.Group("/order")
	apiOrder.POST("/callback", callbackHandler.HandleCallback)
}
