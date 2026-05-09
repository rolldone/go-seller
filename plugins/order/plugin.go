package order

import (
	"fmt"
	"go_framework/internal/plugins"
	authservices "go_framework/plugins/auth/services"
	pluginhandlers "go_framework/plugins/order/handlers"
	pluginservices "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin order provides a minimal scaffold.
type Plugin struct {
	services *pluginservices.Services
	authSvc  *authservices.AuthService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "order" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.services = pluginservices.NewServices(deps.DB, deps.Store)
	// create an auth service instance (shares same DB) so we can perform permission checks
	p.authSvc = authservices.New(deps.DB)
	// no cross-plugin order API registered here (using plugin_registry later)
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if admin == nil || api == nil {
		return fmt.Errorf("order: router groups are nil")
	}
	// register handlers and routes (pass auth service for granular permission checks)
	pluginhandlers.RegisterRoutes(p.services, p.authSvc, admin, api)
	_ = router
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {
	return buildConsoleCommands()
}
