package catalog

import (
	"fmt"
	"go_framework/internal/plugins"
	"go_framework/internal/storage"
	authhandlers "go_framework/plugins/auth/handlers"
	pluginhandlers "go_framework/plugins/catalog/handlers"
	pluginservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin provides a minimal scaffold for catalog functionality.
type Plugin struct {
	service *pluginservices.CatalogService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "catalog" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = pluginservices.New(deps.DB, deps.Store)
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.service == nil {
		return fmt.Errorf("catalog: service not registered; call RegisterServices first")
	}

	// Serve local storage assets from the catalog plugin so core bootstrap
	// no longer needs to register these routes (keeps core safe from edits).
	if localStore, ok := p.service.Store.(*storage.LocalStore); ok {
		router.Static("/assets/businesses", localStore.GetRoot()+"/businesses")
		router.Static("/assets/products", localStore.GetRoot()+"/products")
		router.Static("/assets/reviews", localStore.GetRoot()+"/reviews")
	}

	// Public friendly business route, e.g. /b/:slug
	router.GET("/b/:slug", pluginhandlers.NewBusinessHandler(p.service).PublicGetBySlug)

	productHandler := pluginhandlers.NewProductHandler(p.service)
	businessHandler := pluginhandlers.NewBusinessHandler(p.service)
	categoryHandler := pluginhandlers.NewCategoryHandler(p.service)
	tagHandler := pluginhandlers.NewTagHandler(p.service)
	assetHandler := pluginhandlers.NewProductAssetHandler(p.service)
	businessAssetHandler := pluginhandlers.NewBusinessAssetHandler(p.service)
	businessAssetFolderHandler := pluginhandlers.NewBusinessAssetFolderHandler(p.service)
	businessDisclaimerHandler := pluginhandlers.NewBusinessDisclaimerHandler(p.service)
	searchHandler := pluginhandlers.NewSearchHandler(p.service)
	couponHandler := pluginhandlers.NewCouponHandler(p.service)
	discountHandler := pluginhandlers.NewDiscountHandler(p.service)
	teamHandler := pluginhandlers.NewBusinessTeamHandler(p.service)
	digitalFileHandler := pluginhandlers.NewDigitalFileHandler(p.service)
	variationHandler := pluginhandlers.NewVariationHandler(p.service)

	admin.GET("/plugins/catalog/health", func(c *gin.Context) { c.String(200, "ok") })

	adminCatalog := admin.Group("/catalog")
	adminCatalog.POST("/products", productHandler.Create)
	adminCatalog.GET("/products", productHandler.List)
	adminCatalog.GET("/products/:id", productHandler.GetByID)
	adminCatalog.GET("/products/:id/translations", productHandler.ListTranslations)
	adminCatalog.PUT("/products/:id/translations/:locale", productHandler.UpsertTranslation)
	adminCatalog.PUT("/products/:id", productHandler.Update)
	adminCatalog.DELETE("/products/:id", productHandler.Delete)
	adminCatalog.PATCH("/products/:id/publish", productHandler.Publish)
	adminCatalog.PATCH("/products/:id/unpublish", productHandler.Unpublish)
	adminCatalog.POST("/businesses", businessHandler.Create)
	adminCatalog.GET("/businesses", businessHandler.List)
	adminCatalog.GET("/businesses/:business_id", businessHandler.GetByID)
	adminCatalog.GET("/businesses/:business_id/translations", businessHandler.ListTranslations)
	adminCatalog.PUT("/businesses/:business_id/translations/:locale", businessHandler.UpsertTranslation)
	adminCatalog.PUT("/businesses/:business_id", businessHandler.Update)
	adminCatalog.DELETE("/businesses/:business_id", businessHandler.Delete)

	memberCatalog := api.Group("/member")
	memberPublic := api.Group("/member")
	memberPublic.GET("/team/invites/resolve", teamHandler.ResolveInvite)
	memberPublic.POST("/team/invites/accept", teamHandler.AcceptInvite)
	memberCatalogGroup := api.Group("/member/catalog")

	memberCatalog.Use(authhandlers.RequireMemberJWT())
	memberCatalog.GET("/products", productHandler.MemberList)
	memberCatalog.POST("/products", productHandler.MemberCreate)
	memberCatalog.GET("/products/:id", productHandler.MemberGetByID)
	memberCatalog.PUT("/products/:id", productHandler.MemberUpdate)
	memberCatalog.DELETE("/products/:id", productHandler.MemberDelete)
	memberCatalog.GET("/products/:id/translations", productHandler.ListTranslations)
	memberCatalog.PUT("/products/:id/translations/:locale", productHandler.UpsertTranslation)
	memberCatalog.PATCH("/products/:id/publish", productHandler.MemberPublish)
	memberCatalog.PATCH("/products/:id/unpublish", productHandler.MemberUnpublish)
	memberCatalog.GET("/product-assets/:product_id", assetHandler.MemberList)
	memberCatalog.POST("/product-assets/:product_id", assetHandler.MemberCreate)
	memberCatalog.GET("/product-assets/:product_id/:id", assetHandler.MemberGetByID)
	memberCatalog.PUT("/product-assets/:product_id/:id", assetHandler.MemberUpdate)
	memberCatalog.DELETE("/product-assets/:product_id/:id", assetHandler.MemberDelete)
	memberCatalog.POST("/product-assets/:product_id/upload", assetHandler.MemberUpload)
	memberCatalog.GET("/product-digital-files/:product_id", digitalFileHandler.MemberList)
	memberCatalog.POST("/product-digital-files/:product_id", digitalFileHandler.MemberCreate)
	memberCatalog.GET("/product-digital-files/:product_id/:id", digitalFileHandler.MemberGetByID)
	memberCatalog.PUT("/product-digital-files/:product_id/:id", digitalFileHandler.MemberUpdate)
	memberCatalog.DELETE("/product-digital-files/:product_id/:id", digitalFileHandler.MemberDelete)
	memberCatalog.POST("/product-digital-files/:product_id/upload", digitalFileHandler.MemberUpload)
	memberCatalog.GET("/product-discounts/:product_id", discountHandler.MemberList)
	memberCatalog.POST("/product-discounts/:product_id", discountHandler.MemberCreate)
	memberCatalog.GET("/product-discounts/:product_id/:id", discountHandler.MemberGetByID)
	memberCatalog.PUT("/product-discounts/:product_id/:id", discountHandler.MemberUpdate)
	memberCatalog.DELETE("/product-discounts/:product_id/:id", discountHandler.MemberDelete)
	memberCatalog.GET("/businesses/:business_id/discounts", discountHandler.MemberBusinessList)
	memberCatalog.POST("/businesses/:business_id/discounts", discountHandler.MemberBusinessCreate)
	memberCatalog.GET("/businesses/:business_id/discounts/:id", discountHandler.MemberBusinessGetByID)
	memberCatalog.PUT("/businesses/:business_id/discounts/:id", discountHandler.MemberBusinessUpdate)
	memberCatalog.DELETE("/businesses/:business_id/discounts/:id", discountHandler.MemberBusinessDelete)
	memberCatalog.GET("/businesses", businessHandler.MemberList)
	memberCatalog.POST("/businesses", businessHandler.MemberCreate)
	memberCatalog.GET("/businesses/:business_id", businessHandler.MemberGetByID)
	memberCatalog.PUT("/businesses/:business_id", businessHandler.MemberUpdate)
	memberCatalog.DELETE("/businesses/:business_id", businessHandler.MemberDelete)
	memberCatalog.GET("/businesses/:business_id/translations", businessHandler.MemberListTranslations)
	memberCatalog.PUT("/businesses/:business_id/translations/:locale", businessHandler.MemberUpsertTranslation)
	memberCatalog.POST("/businesses/:business_id/assets", businessAssetHandler.MemberCreate)
	memberCatalog.POST("/businesses/:business_id/assets/upload", businessAssetHandler.MemberUpload)
	memberCatalog.GET("/businesses/:business_id/assets", businessAssetHandler.MemberList)
	memberCatalog.GET("/businesses/:business_id/asset-folders", businessAssetFolderHandler.MemberList)
	memberCatalog.POST("/businesses/:business_id/asset-folders", businessAssetFolderHandler.MemberCreate)
	memberCatalog.PUT("/businesses/:business_id/asset-folders/:folder_id", businessAssetFolderHandler.MemberUpdate)
	memberCatalog.DELETE("/businesses/:business_id/asset-folders/:folder_id", businessAssetFolderHandler.MemberDelete)
	memberCatalog.GET("/businesses/:business_id/assets/:asset_id", businessAssetHandler.MemberGetByID)
	memberCatalog.PUT("/businesses/:business_id/assets/:asset_id", businessAssetHandler.MemberUpdate)
	memberCatalog.POST("/businesses/:business_id/assets/:asset_id/move", businessAssetHandler.MemberMove)
	memberCatalog.POST("/businesses/:business_id/assets/:asset_id/copy", businessAssetHandler.MemberCopy)
	memberCatalog.DELETE("/businesses/:business_id/assets/:asset_id", businessAssetHandler.MemberDelete)
	memberCatalog.POST("/businesses/:business_id/assets/:asset_id/finalize", businessAssetHandler.MemberFinalize)
	memberCatalog.POST("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.MemberRegisterDerivative)
	memberCatalog.GET("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.MemberListDerivatives)
	memberCatalog.GET("/businesses/:business_id/coupons", couponHandler.MemberBusinessList)
	memberCatalog.POST("/businesses/:business_id/coupons", couponHandler.MemberBusinessCreate)
	memberCatalog.GET("/businesses/:business_id/coupons/:id", couponHandler.MemberBusinessGetByID)
	memberCatalog.PUT("/businesses/:business_id/coupons/:id", couponHandler.MemberBusinessUpdate)
	memberCatalog.DELETE("/businesses/:business_id/coupons/:id", couponHandler.MemberBusinessDelete)
	memberCatalog.GET("/businesses/:business_id/team/members", teamHandler.ListMembers)
	memberCatalog.POST("/businesses/:business_id/team/members/invite", teamHandler.InviteMember)
	memberCatalog.PATCH("/businesses/:business_id/team/members/:member_id/role", teamHandler.UpdateMemberRole)
	memberCatalog.PATCH("/businesses/:business_id/team/members/:member_id/status", teamHandler.UpdateMemberStatus)
	memberCatalog.DELETE("/businesses/:business_id/team/members/:member_id", teamHandler.DeleteMember)

	memberCatalog.POST("/businesses/:business_id/disclaimers", businessDisclaimerHandler.MemberCreate)
	memberCatalog.GET("/businesses/:business_id/disclaimers", businessDisclaimerHandler.MemberList)
	memberCatalog.GET("/businesses/:business_id/disclaimers/:disclaimer_id", businessDisclaimerHandler.MemberGetByID)
	memberCatalog.PUT("/businesses/:business_id/disclaimers/:disclaimer_id", businessDisclaimerHandler.MemberUpdate)
	memberCatalog.DELETE("/businesses/:business_id/disclaimers/:disclaimer_id", businessDisclaimerHandler.MemberDelete)
	memberCatalog.GET("/businesses/:business_id/disclaimers/:disclaimer_id/translations", businessDisclaimerHandler.MemberListTranslations)
	memberCatalog.PUT("/businesses/:business_id/disclaimers/:disclaimer_id/translations/:locale", businessDisclaimerHandler.MemberUpsertTranslation)
	memberCatalogGroup.Use(authhandlers.RequireMemberJWT())
	memberCatalogGroup.GET("/categories", categoryHandler.List)
	memberCatalogGroup.GET("/categories/:id", categoryHandler.GetByID)
	memberCatalogGroup.GET("/tags", tagHandler.List)
	memberCatalogGroup.GET("/tags/:id", tagHandler.GetByID)
	adminCatalog.POST("/categories", categoryHandler.Create)
	adminCatalog.GET("/categories", categoryHandler.List)
	adminCatalog.GET("/categories/:id", categoryHandler.GetByID)
	adminCatalog.GET("/categories/:id/translations", categoryHandler.ListTranslations)
	adminCatalog.PUT("/categories/:id/translations/:locale", categoryHandler.UpsertTranslation)
	adminCatalog.PUT("/categories/:id", categoryHandler.Update)
	adminCatalog.DELETE("/categories/:id", categoryHandler.Delete)
	adminCatalog.POST("/categories/:id/restore", categoryHandler.Restore)
	adminCatalog.POST("/tags", tagHandler.Create)
	adminCatalog.GET("/tags", tagHandler.List)
	adminCatalog.GET("/tags/:id", tagHandler.GetByID)
	adminCatalog.PUT("/tags/:id", tagHandler.Update)
	adminCatalog.DELETE("/tags/:id", tagHandler.Delete)
	adminCatalog.POST("/coupons", couponHandler.Create)
	adminCatalog.GET("/coupons", couponHandler.List)
	adminCatalog.GET("/coupons/:id", couponHandler.GetByID)
	adminCatalog.PUT("/coupons/:id", couponHandler.Update)
	adminCatalog.DELETE("/coupons/:id", couponHandler.Delete)
	adminCatalog.POST("/discounts", discountHandler.Create)
	adminCatalog.GET("/discounts", discountHandler.List)
	adminCatalog.GET("/discounts/:id", discountHandler.GetByID)
	adminCatalog.PUT("/discounts/:id", discountHandler.Update)
	adminCatalog.DELETE("/discounts/:id", discountHandler.Delete)
	adminCatalog.POST("/assets", assetHandler.Create)
	adminCatalog.POST("/assets/upload", assetHandler.Upload)
	adminCatalog.GET("/assets", assetHandler.List)
	adminCatalog.GET("/assets/:id", assetHandler.GetByID)
	adminCatalog.PUT("/assets/:id", assetHandler.Update)
	adminCatalog.DELETE("/assets/:id", assetHandler.Delete)

	// Digital file routes (admin)
	adminCatalog.GET("/digital-files", digitalFileHandler.List)
	adminCatalog.POST("/digital-files", digitalFileHandler.Create)
	adminCatalog.POST("/digital-files/upload", digitalFileHandler.Upload)
	adminCatalog.GET("/digital-files/:id", digitalFileHandler.GetByID)
	adminCatalog.PATCH("/digital-files/:id", digitalFileHandler.Update)
	adminCatalog.DELETE("/digital-files/:id", digitalFileHandler.Delete)

	// Attribute Groups routes
	adminCatalog.POST("/attribute-groups", variationHandler.CreateAttributeGroup)
	adminCatalog.GET("/attribute-groups", variationHandler.ListAttributeGroups)
	// Nested specific route BEFORE single param route!
	adminCatalog.GET("/attribute-groups/:id/attributes", variationHandler.ListAttributesByGroup)
	adminCatalog.GET("/attribute-groups/:id", variationHandler.GetAttributeGroup)
	adminCatalog.PUT("/attribute-groups/:id", variationHandler.UpdateAttributeGroup)
	adminCatalog.DELETE("/attribute-groups/:id", variationHandler.DeleteAttributeGroup)

	// Attributes routes
	adminCatalog.POST("/attributes", variationHandler.CreateAttribute)
	adminCatalog.GET("/attributes/:id", variationHandler.GetAttribute)
	adminCatalog.PUT("/attributes/:id", variationHandler.UpdateAttribute)
	adminCatalog.DELETE("/attributes/:id", variationHandler.DeleteAttribute)

	// Product Variations routes - specific before general
	adminCatalog.GET("/variations/by-attributes", variationHandler.GetVariationByAttributes)
	adminCatalog.POST("/variations", variationHandler.CreateProductVariation)
	adminCatalog.GET("/variations", variationHandler.ListProductVariations)
	adminCatalog.GET("/variations/:id", variationHandler.GetProductVariation)
	adminCatalog.PUT("/variations/:id", variationHandler.UpdateProductVariation)
	adminCatalog.PUT("/variations/:id/assets", variationHandler.UpdateVariationAssets)
	adminCatalog.DELETE("/variations/:id", variationHandler.DeleteProductVariation)

	// Business assets routes
	adminCatalog.POST("/businesses/:business_id/assets", businessAssetHandler.Create)
	adminCatalog.POST("/businesses/:business_id/assets/upload", businessAssetHandler.Upload)
	adminCatalog.GET("/businesses/:business_id/assets", businessAssetHandler.List)
	adminCatalog.GET("/businesses/:business_id/asset-folders", businessAssetFolderHandler.List)
	adminCatalog.POST("/businesses/:business_id/asset-folders", businessAssetFolderHandler.Create)
	adminCatalog.PUT("/businesses/:business_id/asset-folders/:folder_id", businessAssetFolderHandler.Update)
	adminCatalog.DELETE("/businesses/:business_id/asset-folders/:folder_id", businessAssetFolderHandler.Delete)
	adminCatalog.GET("/businesses/:business_id/assets/:asset_id", businessAssetHandler.GetByID)
	adminCatalog.PUT("/businesses/:business_id/assets/:asset_id", businessAssetHandler.Update)
	adminCatalog.POST("/businesses/:business_id/assets/:asset_id/move", businessAssetHandler.Move)
	adminCatalog.POST("/businesses/:business_id/assets/:asset_id/copy", businessAssetHandler.Copy)
	adminCatalog.DELETE("/businesses/:business_id/assets/:asset_id", businessAssetHandler.Delete)
	adminCatalog.POST("/businesses/:business_id/assets/:asset_id/finalize", businessAssetHandler.Finalize)
	adminCatalog.POST("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.RegisterDerivative)
	adminCatalog.GET("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.ListDerivatives)

	// Business disclaimers (admin CRUD)
	adminCatalog.POST("/businesses/:business_id/disclaimers", businessDisclaimerHandler.Create)
	adminCatalog.GET("/businesses/:business_id/disclaimers", businessDisclaimerHandler.List)
	adminCatalog.GET("/businesses/:business_id/disclaimers/:disclaimer_id", businessDisclaimerHandler.GetByID)
	adminCatalog.GET("/businesses/:business_id/disclaimers/:disclaimer_id/translations", businessDisclaimerHandler.ListTranslations)
	adminCatalog.PUT("/businesses/:business_id/disclaimers/:disclaimer_id/translations/:locale", businessDisclaimerHandler.UpsertTranslation)
	adminCatalog.PUT("/businesses/:business_id/disclaimers/:disclaimer_id", businessDisclaimerHandler.Update)
	adminCatalog.DELETE("/businesses/:business_id/disclaimers/:disclaimer_id", businessDisclaimerHandler.Delete)
	adminCatalog.GET("/search", searchHandler.Search)

	apiCatalog := api.Group("/catalog")
	apiCatalog.GET("/products", productHandler.PublicList)
	apiCatalog.GET("/products/:id", productHandler.PublicGetByID)
	apiCatalog.GET("/businesses", businessHandler.List)
	apiCatalog.GET("/businesses/:business_id", businessHandler.GetByID)
	apiCatalog.GET("/businesses/:business_id/disclaimers", businessDisclaimerHandler.PublicList)
	// (route for business products removed — products included in /b/:slug response)
	apiCatalog.GET("/categories", categoryHandler.List)
	apiCatalog.GET("/tags", tagHandler.List)
	apiCatalog.GET("/assets", assetHandler.List)
	apiCatalog.GET("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.PublicListDerivatives)
	apiCatalog.GET("/businesses/:business_id/assets/:asset_id/derivatives/:derivative_id", businessAssetHandler.PublicGetDerivative)
	apiCatalog.GET("/search", searchHandler.PublicSearch)
	apiCatalog.GET("/variations", variationHandler.ListProductVariations)
	// Product Variations public lookup
	apiCatalog.GET("/variations/by-attributes", variationHandler.GetVariationByAttributes)

	// Digital file download — customer must have paid order for this product
	apiCatalog.GET("/digital-files/:id/download", authhandlers.RequireCustomerJWT(), digitalFileHandler.CustomerDownload)
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command { return nil }
