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
	adminOrder.Use(RequireOrderAdminJWT())
	adminOrder.GET("/health", HealthHandler)

	// cart handlers
	cartHandler := NewCartHandler(s.Cart, s.Order, authSvc)
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
	memberOrderHandler := NewMemberOrderHandler(s.Order, s.Payment, s.Catalog, authSvc)
	memberShipmentHandler := NewMemberShipmentHandler(s.Shipment, s.Order, s.Catalog)
	apiOrder.GET("/payments/:payment_id", paymentHandler.LookupByID)
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
	adminPaymentProviders.POST("/:id/replace-secret", paymentHandler.ReplaceProviderSecret)
	adminPaymentProviders.POST("/:id/activate", paymentHandler.ActivateProvider)

	adminPaymentMethods := adminOrder.Group("/payment-methods")
	adminPaymentMethods.GET("", paymentHandler.ListMethods)
	adminPaymentMethods.GET("/:id", paymentHandler.GetMethod)
	adminPaymentMethods.POST("", paymentHandler.CreateMethod)
	adminPaymentMethods.PUT("/:id", paymentHandler.UpdateMethod)
	adminPaymentMethods.DELETE("/:id", paymentHandler.DeleteMethod)

	orderHandler := NewOrderHandler(s.Order, s.Payment, s.Catalog, authSvc)
	guestCheckoutHandler := NewGuestCheckoutHandler(s.Order, s.Payment, authSvc)
	// require permission: view orders
	adminOrder.GET("/orders", pluginregistry.RequirePermission("orders.view"), orderHandler.AdminList)
	adminOrder.GET("/orders/:id", pluginregistry.RequirePermission("orders.view"), orderHandler.GetByID)
	adminOrder.GET("/orders/:id/invoice", pluginregistry.RequirePermission("orders.view"), orderHandler.DownloadInvoice)
	// create/manage orders
	adminOrder.POST("/orders", pluginregistry.RequirePermission("orders.manage"), orderHandler.AdminCreate)
	adminOrder.PATCH("/orders/:id", pluginregistry.RequirePermission("orders.manage"), orderHandler.Update)
	adminOrder.POST("/orders/:id/status", pluginregistry.RequirePermission("orders.manage"), orderHandler.SetStatus)
	adminOrder.PUT("/orders/:id/extra-charges", pluginregistry.RequirePermission("orders.manage"), orderHandler.ReplaceExtraCharges)
	adminOrder.PUT("/orders/:id/shipping", pluginregistry.RequirePermission("orders.manage"), orderHandler.UpdateShippingQuote)
	adminOrder.POST("/orders/:id/shipping-address", pluginregistry.RequirePermission("orders.manage"), orderHandler.AdminUpdateShippingAddress)
	adminOrder.POST("/orders/:id/items", pluginregistry.RequirePermission("orders.manage"), orderHandler.AddItem)
	adminOrder.DELETE("/orders/:id/items/:item_id", pluginregistry.RequirePermission("orders.manage"), orderHandler.DeleteItem)
	adminOrder.POST("/orders/:id/items/:item_id/discount", pluginregistry.RequirePermission("orders.manage"), orderHandler.ApplyItemDiscount)
	adminOrder.DELETE("/orders/:id/items/:item_id/discount", pluginregistry.RequirePermission("orders.manage"), orderHandler.RemoveItemDiscount)
	adminOrder.POST("/orders/:id/finalize", pluginregistry.RequirePermission("orders.manage"), orderHandler.Finalize)
	adminOrder.POST("/orders/:id/dispute/resolve-seller", pluginregistry.RequirePermission("orders.manage"), orderHandler.AdminResolveDisputeForSeller)
	adminOrder.POST("/orders/:id/dispute/resolve-customer", pluginregistry.RequirePermission("orders.manage"), orderHandler.AdminResolveDisputeForCustomer)
	adminOrder.POST("/orders/:id/dispute/refund-completed", pluginregistry.RequirePermission("orders.manage"), orderHandler.AdminMarkDisputeRefundCompleted)
	adminOrder.POST("/orders/:id/coupon", pluginregistry.RequirePermission("orders.manage"), orderHandler.ApplyCoupon)
	adminOrder.DELETE("/orders/:id/coupon/:code", pluginregistry.RequirePermission("orders.manage"), orderHandler.RemoveCoupon)
	adminOrder.POST("/orders/:id/guest-token", pluginregistry.RequirePermission("orders.manage"), guestCheckoutHandler.GenerateToken)

	// Shipment routes (per resi, per order)
	shipmentHandler := NewShipmentHandler(s.Shipment)
	adminOrder.GET("/orders/:id/shipments", pluginregistry.RequirePermission("orders.view"), shipmentHandler.ListShipments)
	adminOrder.GET("/orders/:id/shippable-items", pluginregistry.RequirePermission("orders.view"), shipmentHandler.ShippableItems)
	adminOrder.POST("/orders/:id/shipments", pluginregistry.RequirePermission("orders.manage"), shipmentHandler.CreateShipment)
	adminOrder.PATCH("/shipments/:shipment_id", pluginregistry.RequirePermission("orders.manage"), shipmentHandler.UpdateShipment)
	adminOrder.DELETE("/shipments/:shipment_id", pluginregistry.RequirePermission("orders.manage"), shipmentHandler.DeleteShipment)
	adminOrder.GET("/shipments/:shipment_id", pluginregistry.RequirePermission("orders.view"), shipmentHandler.GetShipment)

	customerOrder := apiOrder.Group("/orders")
	customerOrder.Use(RequireOrderCustomerJWT())
	customerOrder.GET("/me", orderHandler.MeList)
	customerOrder.GET("/me/:id", orderHandler.MeGetByID)
	customerOrder.POST("/me/:id/customer-confirmation/approve", orderHandler.MeApproveCustomerConfirmation)
	customerOrder.POST("/me/:id/customer-confirmation/reject", orderHandler.MeRejectCustomerConfirmation)
	customerOrder.GET("/me/:id/invoice", orderHandler.MeDownloadInvoice)
	customerOrder.POST("/me/:id/shipping-address", orderHandler.MeUpdateShippingAddress)
	customerOrder.POST("/me/:id/start-payment", orderHandler.MeStartPayment)
	customerOrder.GET("/me/:id/payments/:payment_id/proofs", orderHandler.MeListPaymentProofs)
	customerOrder.GET("/me/:id/payments/:payment_id/proofs/:proof_id/access", orderHandler.MePaymentProofAccess)

	memberOrder := api.Group("/member")
	memberOrder.Use(authhandlers.RequireMemberJWT())
	memberBusinessOrders := memberOrder.Group("/businesses/:business_id/orders")
	memberBusinessReports := memberOrder.Group("/businesses/:business_id/reports")
	memberBusinessOrders.GET("", memberOrderHandler.List)
	memberBusinessOrders.GET("/customers", memberOrderHandler.ListCustomers)
	memberBusinessOrders.POST("", memberOrderHandler.CreateDraft)
	memberBusinessOrders.GET("/:id", memberOrderHandler.GetByID)
	memberBusinessOrders.GET("/:id/invoice", memberOrderHandler.DownloadInvoice)
	memberBusinessOrders.PATCH("/:id", memberOrderHandler.Update)
	memberBusinessOrders.POST("/:id/items", memberOrderHandler.AddItem)
	memberBusinessOrders.DELETE("/:id/items/:item_id", memberOrderHandler.DeleteItem)
	memberBusinessOrders.POST("/:id/items/:item_id/discount", memberOrderHandler.ApplyItemDiscount)
	memberBusinessOrders.DELETE("/:id/items/:item_id/discount", memberOrderHandler.RemoveItemDiscount)
	memberBusinessOrders.POST("/:id/finalize", memberOrderHandler.Finalize)
	memberBusinessOrders.POST("/:id/customer-confirmation", memberOrderHandler.RequestCustomerConfirmation)
	memberBusinessOrders.POST("/:id/dispute/note", memberOrderHandler.UpsertDisputeNote)
	memberBusinessOrders.POST("/:id/coupon", memberOrderHandler.ApplyCoupon)
	memberBusinessOrders.DELETE("/:id/coupon/:code", memberOrderHandler.RemoveCoupon)
	memberBusinessOrders.POST("/:id/shipping-address", memberOrderHandler.UpdateShippingAddress)
	memberBusinessOrders.PUT("/:id/extra-charges", memberOrderHandler.ReplaceExtraCharges)
	memberBusinessOrders.PUT("/:id/shipping", memberOrderHandler.UpdateShippingQuote)
	memberBusinessOrders.GET("/:id/shipments", memberShipmentHandler.ListShipments)
	memberBusinessOrders.GET("/:id/shippable-items", memberShipmentHandler.ShippableItems)
	memberBusinessOrders.POST("/:id/shipments", memberShipmentHandler.CreateShipment)
	memberBusinessReports.GET("/pdf", memberOrderHandler.DownloadReportPDF)
	memberBusinessOrders.GET("/:id/shipments/:shipment_id", memberShipmentHandler.GetShipment)
	memberBusinessOrders.PATCH("/:id/shipments/:shipment_id", memberShipmentHandler.UpdateShipment)
	memberBusinessOrders.DELETE("/:id/shipments/:shipment_id", memberShipmentHandler.DeleteShipment)

	// Seller balance routes (member - seller view)
	sellerBalanceHandler := NewSellerBalanceHandler(s.SellerBalance, s.Catalog)
	sellerWithdrawalHandler := NewSellerWithdrawalHandler(s.SellerWithdrawal, s.Catalog)
	memberBusinessBalance := memberOrder.Group("/businesses/:business_id/balance")
	memberBusinessBalance.GET("", sellerBalanceHandler.GetBalance)
	memberBusinessBalance.GET("/mutations", sellerBalanceHandler.ListMutations)
	memberBusinessBalance.GET("/settlements/summary", sellerBalanceHandler.MemberSettlementSummary)
	memberBusinessBalance.GET("/settlements", sellerBalanceHandler.MemberListSettlements)
	memberBusinessBalance.GET("/withdrawals", sellerWithdrawalHandler.ListWithdrawals)
	memberBusinessBalance.POST("/withdrawals", sellerWithdrawalHandler.RequestWithdrawal)
	memberBusinessBalance.GET("/withdrawals/:id", sellerWithdrawalHandler.GetWithdrawal)

	// Member notification groups (per-business additional email recipients)
	notifGroupHandler := NewNotificationGroupHandler(s.NotificationGroup)
	memberBusinessNotifGroups := memberOrder.Group("/businesses/:business_id/notification-groups")
	memberBusinessNotifGroups.GET("", notifGroupHandler.ListGroups)
	memberBusinessNotifGroups.POST("", notifGroupHandler.CreateGroup)
	memberBusinessNotifGroups.PUT("/:id", notifGroupHandler.UpdateGroup)
	memberBusinessNotifGroups.DELETE("/:id", notifGroupHandler.DeleteGroup)
	memberOrder.GET("/notification-groups/events", notifGroupHandler.ListValidEvents)

	// Admin seller balance management
	adminSellerBalance := adminOrder.Group("/seller-balance")
	settlementHandler := NewSellerSettlementHandler(s.SellerBalance)
	adminSellerBalance.GET("/summary", sellerBalanceHandler.AdminGetSummary)
	adminSellerBalance.POST("/:seller_id/credit", sellerBalanceHandler.AdminCreditBalance)
	adminSellerBalance.POST("/:seller_id/debet", sellerBalanceHandler.AdminDebetBalance)
	adminSellerBalance.GET("/settlements", settlementHandler.AdminListSettlements)
	adminSellerBalance.GET("/settlements/:id", settlementHandler.AdminGetSettlement)
	adminSellerBalance.POST("/settlements/:id/decision", settlementHandler.AdminDecideSettlement)

	// Admin withdrawal management
	adminWithdrawals := adminOrder.Group("/withdrawals")
	adminWithdrawals.GET("", sellerWithdrawalHandler.AdminListWithdrawals)
	adminWithdrawals.GET("/:id", sellerWithdrawalHandler.AdminGetWithdrawal)
	adminWithdrawals.GET("/:id/audit", sellerWithdrawalHandler.AdminListWithdrawalAudits)
	adminWithdrawals.POST("/:id/approve", sellerWithdrawalHandler.AdminApproveWithdrawal)
	adminWithdrawals.POST("/:id/reject", sellerWithdrawalHandler.AdminRejectWithdrawal)
	adminWithdrawals.POST("/:id/process", sellerWithdrawalHandler.AdminMarkProcessed)

	// Server-to-server callback endpoint — payload is AES-GCM encrypted with shared S2S_KEY.
	callbackHandler := NewCallbackHandler(s.Order)
	apiOrder.POST("/callback", callbackHandler.HandleCallback)
	apiOrder.GET("/guest-checkout/:token", guestCheckoutHandler.GetDetail)
	apiOrder.GET("/guest-checkout/:token/addresses", guestCheckoutHandler.ListAddresses)
	apiOrder.POST("/guest-checkout/:token/addresses", guestCheckoutHandler.CreateAddress)
	apiOrder.POST("/guest-checkout/:token/shipping-address", guestCheckoutHandler.UpdateShippingAddress)
	apiOrder.POST("/guest-checkout/:token/start-payment", guestCheckoutHandler.StartPayment)

	// Public: list active payment methods (for checkout UI)
	apiOrder.GET("/payment-methods", paymentHandler.ListMethods)
}
