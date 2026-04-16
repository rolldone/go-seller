package marketing

import (
	"fmt"

	"go_framework/internal/plugins"
	marketinghandlers "go_framework/plugins/marketing/handlers"
	marketingservices "go_framework/plugins/marketing/services"
	pluginregistry "go_framework/plugins/plugin_registry"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin marketing provides a minimal scaffold.
type Plugin struct {
	service *marketingservices.Service
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "marketing" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = marketingservices.New(deps.DB)
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.service == nil {
		return fmt.Errorf("marketing: service not registered; call RegisterServices first")
	}

	handler := marketinghandlers.NewBusinessCarouselHandler(p.service)
	subsHandler := marketinghandlers.NewSubscriptionHandler(p.service)

	admin.GET("/plugins/marketing/health", marketinghandlers.HealthHandler)

	adminMarketing := admin.Group("/marketing")
	adminMarketing.GET("/business-carousels", handler.List)
	adminMarketing.GET("/business-carousels/:id", handler.GetByID)
	adminMarketing.POST("/business-carousels", handler.Create)
	adminMarketing.PUT("/business-carousels/:id", handler.Update)
	adminMarketing.DELETE("/business-carousels/:id", handler.Delete)
	// Subscriptions (admin)
	adminMarketing.GET("/subscriptions", pluginregistry.RequirePermission("subscriptions.view"), subsHandler.List)
	adminMarketing.GET("/subscriptions/:id", pluginregistry.RequirePermission("subscriptions.view"), subsHandler.GetByID)
	adminMarketing.POST("/subscriptions/export", pluginregistry.RequirePermission("subscriptions.manage"), subsHandler.Export)
	adminMarketing.DELETE("/subscriptions/:id", pluginregistry.RequirePermission("subscriptions.manage"), subsHandler.Delete)
	adminMarketing.POST("/subscriptions/:id/resend", pluginregistry.RequirePermission("subscriptions.manage"), subsHandler.AdminResend)

	apiMarketing := api.Group("/marketing")
	apiMarketing.GET("/business-carousels", handler.PublicList)
	// Public subscribe/unsubscribe endpoints
	apiMarketing.GET("/confirm", subsHandler.Confirm)
	apiMarketing.POST("/resend", subsHandler.PublicResend)
	apiMarketing.POST("/subscribe", subsHandler.PublicSubscribe)
	apiMarketing.POST("/unsubscribe", subsHandler.PublicUnsubscribe)

	_ = router
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {
	cmd := &cobra.Command{
		Use:   "marketing:hello",
		Short: "hello from marketing",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin marketing\\n")
		},
	}
	return []*cobra.Command{cmd}
}
