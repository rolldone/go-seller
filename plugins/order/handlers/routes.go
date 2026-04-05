package handlers

import (
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
	adminOrder.Use(RequireOrderAdminJWT())
	adminOrder.GET("/health", HealthHandler)

	// cart handlers
	cartHandler := NewCartHandler(s.Cart, s.Order)
	adminCart := adminOrder.Group("/carts")
	adminCart.POST("", cartHandler.Create)
	adminCart.POST("/:id/items", cartHandler.AddItem)
	adminCart.GET("/:id", cartHandler.Get)
	adminCart.POST("/:id/checkout", cartHandler.Checkout)

	apiOrder := api.Group("/order")
	customerCart := apiOrder.Group("/carts")
	customerCart.Use(RequireOrderCustomerJWT())
	customerCart.GET("/me", cartHandler.Me)
	customerCart.GET("/me/preview", cartHandler.MePreview)
	customerCart.GET("/me/businesses", cartHandler.MeBusinesses)
	customerCart.POST("/me/items", cartHandler.MeAddItem)
	customerCart.PATCH("/me/items/:item_id", cartHandler.MeUpdateItem)
	customerCart.DELETE("/me/items/:item_id", cartHandler.MeDeleteItem)
	customerCart.POST("/me/checkout", cartHandler.MeCheckout)

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
	adminPayment.POST("/:id/cancel", paymentHandler.Cancel)
	adminPayment.POST("/:id/reject", paymentHandler.Reject)
	adminPayment.POST("/:id/recheck", paymentHandler.Recheck)
	adminPayment.GET("/report", paymentHandler.Report)
	adminPayment.POST("/:id/proof", paymentHandler.UploadProof)
	adminPayment.POST("/:id/proof/:proof_id/approve", paymentHandler.ApproveProof)
	adminPayment.POST("/:id/proof/:proof_id/reject", paymentHandler.RejectProof)
	adminPayment.GET("/:id/proofs", paymentHandler.ListProofs)
	adminPayment.DELETE("/:id/proofs/:proof_id", paymentHandler.DeleteProof)
	adminPayment.GET("/:id/proofs/:proof_id/access", paymentHandler.ProofAccess)
	// streaming proxy for admin to fetch payment proof content (no signed URL exposed)
	paymentAssetHandler := NewPaymentAssetHandler(s)
	adminPayment.GET("/:id/proofs/:proof_id/stream", paymentAssetHandler.StreamProof)

	adminPaymentProviders := adminOrder.Group("/payment-providers")
	adminPaymentProviders.GET("", paymentHandler.ListProviders)
	adminPaymentProviders.GET("/:id", paymentHandler.GetProvider)
	adminPaymentProviders.POST("", paymentHandler.CreateProvider)
	adminPaymentProviders.PUT("/:id", paymentHandler.UpdateProvider)
	adminPaymentProviders.POST("/:id/activate", paymentHandler.ActivateProvider)

	// order handlers (admin)
	orderHandler := NewOrderHandler(s.Order, s.Payment, s.Catalog)
	guestCheckoutHandler := NewGuestCheckoutHandler(s.Order, s.Payment)
	// require permission: view orders
	adminOrder.GET("/orders", pluginregistry.RequirePermission("orders.view"), orderHandler.AdminList)
	adminOrder.GET("/orders/:id", pluginregistry.RequirePermission("orders.view"), orderHandler.GetByID)
	adminOrder.GET("/orders/:id/invoice", pluginregistry.RequirePermission("orders.view"), orderHandler.DownloadInvoice)
	// create/manage orders
	adminOrder.POST("/orders", pluginregistry.RequirePermission("orders.manage"), orderHandler.AdminCreate)
	adminOrder.PATCH("/orders/:id", pluginregistry.RequirePermission("orders.manage"), orderHandler.Update)
	adminOrder.POST("/orders/:id/status", pluginregistry.RequirePermission("orders.manage"), orderHandler.SetStatus)
	adminOrder.POST("/orders/:id/items", pluginregistry.RequirePermission("orders.manage"), orderHandler.AddItem)
	adminOrder.DELETE("/orders/:id/items/:item_id", pluginregistry.RequirePermission("orders.manage"), orderHandler.DeleteItem)
	adminOrder.POST("/orders/:id/items/:item_id/discount", pluginregistry.RequirePermission("orders.manage"), orderHandler.ApplyItemDiscount)
	adminOrder.DELETE("/orders/:id/items/:item_id/discount", pluginregistry.RequirePermission("orders.manage"), orderHandler.RemoveItemDiscount)
	adminOrder.POST("/orders/:id/finalize", pluginregistry.RequirePermission("orders.manage"), orderHandler.Finalize)
	adminOrder.POST("/orders/:id/coupon", pluginregistry.RequirePermission("orders.manage"), orderHandler.ApplyCoupon)
	adminOrder.DELETE("/orders/:id/coupon/:code", pluginregistry.RequirePermission("orders.manage"), orderHandler.RemoveCoupon)
	adminOrder.POST("/orders/:id/guest-token", pluginregistry.RequirePermission("orders.manage"), guestCheckoutHandler.GenerateToken)

	customerOrder := apiOrder.Group("/orders")
	customerOrder.Use(RequireOrderCustomerJWT())
	customerOrder.GET("/me", orderHandler.MeList)
	customerOrder.GET("/me/:id", orderHandler.MeGetByID)
	customerOrder.GET("/me/:id/invoice", orderHandler.MeDownloadInvoice)
	customerOrder.POST("/me/:id/start-payment", orderHandler.MeStartPayment)
	customerOrder.GET("/me/:id/payments/:payment_id/proofs", orderHandler.MeListPaymentProofs)
	customerOrder.GET("/me/:id/payments/:payment_id/proofs/:proof_id/access", orderHandler.MePaymentProofAccess)

	// Server-to-server callback endpoint — payload is AES-GCM encrypted with shared S2S_KEY.
	callbackHandler := NewCallbackHandler(s.Order)
	apiOrder.POST("/callback", callbackHandler.HandleCallback)
	apiOrder.GET("/guest-checkout/:token", guestCheckoutHandler.GetDetail)
	apiOrder.POST("/guest-checkout/:token/start-payment", guestCheckoutHandler.StartPayment)
}
