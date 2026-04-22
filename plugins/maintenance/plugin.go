package maintenance

import (
	"go_framework/internal/plugins"
	maintenanceconsole "go_framework/plugins/maintenance/console"
	pluginhandlers "go_framework/plugins/maintenance/handlers"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin maintenance provides a minimal scaffold.
type Plugin struct{}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "maintenance" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error { _ = deps; registerEventHandlers(); return nil }

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	admin.GET("/plugins/maintenance/health", pluginhandlers.HealthHandler)
	_ = router
	_ = api
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {
	return []*cobra.Command{
		maintenanceconsole.DeleteCmd(),
	}
}
