package catalog

import (
	"fmt"
	"go_framework/internal/plugins"
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

	productHandler := pluginhandlers.NewProductHandler(p.service)
	businessHandler := pluginhandlers.NewBusinessHandler(p.service)
	categoryHandler := pluginhandlers.NewCategoryHandler(p.service)
	tagHandler := pluginhandlers.NewTagHandler(p.service)
	assetHandler := pluginhandlers.NewProductAssetHandler(p.service)
	businessAssetHandler := pluginhandlers.NewBusinessAssetHandler(p.service)
	searchHandler := pluginhandlers.NewSearchHandler(p.service)
	couponHandler := pluginhandlers.NewCouponHandler(p.service)
	discountHandler := pluginhandlers.NewDiscountHandler(p.service)

	admin.GET("/plugins/catalog/health", func(c *gin.Context) { c.String(200, "ok") })

	adminCatalog := admin.Group("/catalog")
	adminCatalog.POST("/products", productHandler.Create)
	adminCatalog.GET("/products", productHandler.List)
	adminCatalog.GET("/products/:id", productHandler.GetByID)
	adminCatalog.PUT("/products/:id", productHandler.Update)
	adminCatalog.DELETE("/products/:id", productHandler.Delete)
	adminCatalog.PATCH("/products/:id/publish", productHandler.Publish)
	adminCatalog.PATCH("/products/:id/unpublish", productHandler.Unpublish)
	adminCatalog.POST("/businesses", businessHandler.Create)
	adminCatalog.GET("/businesses", businessHandler.List)
	adminCatalog.GET("/businesses/:business_id", businessHandler.GetByID)
	adminCatalog.PUT("/businesses/:business_id", businessHandler.Update)
	adminCatalog.DELETE("/businesses/:business_id", businessHandler.Delete)
	adminCatalog.POST("/categories", categoryHandler.Create)
	adminCatalog.GET("/categories", categoryHandler.List)
	adminCatalog.GET("/categories/:id", categoryHandler.GetByID)
	adminCatalog.PUT("/categories/:id", categoryHandler.Update)
	adminCatalog.DELETE("/categories/:id", categoryHandler.Delete)
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

	// Business assets routes
	adminCatalog.POST("/businesses/:business_id/assets", businessAssetHandler.Create)
	adminCatalog.POST("/businesses/:business_id/assets/upload", businessAssetHandler.Upload)
	adminCatalog.GET("/businesses/:business_id/assets", businessAssetHandler.List)
	adminCatalog.GET("/businesses/:business_id/assets/:asset_id", businessAssetHandler.GetByID)
	adminCatalog.PUT("/businesses/:business_id/assets/:asset_id", businessAssetHandler.Update)
	adminCatalog.DELETE("/businesses/:business_id/assets/:asset_id", businessAssetHandler.Delete)
	adminCatalog.POST("/businesses/:business_id/assets/:asset_id/finalize", businessAssetHandler.Finalize)
	adminCatalog.POST("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.RegisterDerivative)
	adminCatalog.GET("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.ListDerivatives)
	adminCatalog.GET("/search", searchHandler.Search)

	apiCatalog := api.Group("/catalog")
	apiCatalog.GET("/products", productHandler.PublicList)
	apiCatalog.GET("/products/:id", productHandler.PublicGetByID)
	apiCatalog.GET("/businesses", businessHandler.List)
	apiCatalog.GET("/businesses/:business_id", businessHandler.GetByID)
	apiCatalog.GET("/categories", categoryHandler.List)
	apiCatalog.GET("/tags", tagHandler.List)
	apiCatalog.GET("/assets", assetHandler.List)
	apiCatalog.GET("/businesses/:business_id/assets/:asset_id/derivatives", businessAssetHandler.PublicListDerivatives)
	apiCatalog.GET("/businesses/:business_id/assets/:asset_id/derivatives/:derivative_id", businessAssetHandler.PublicGetDerivative)
	apiCatalog.GET("/search", searchHandler.PublicSearch)
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command { return nil }
