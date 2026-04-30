package payment_gateway

import (
	"go_framework/internal/plugins"
	authservices "go_framework/plugins/auth/services"
	pluginhandlers "go_framework/plugins/payment_gateway/handlers"
	pgwservices "go_framework/plugins/payment_gateway/services"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin payment_gateway provides a minimal scaffold.
type Plugin struct {
	authSvc *authservices.AuthService
	logSvc  *pgwservices.LogService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "payment_gateway" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.authSvc = authservices.New(deps.DB)
	p.logSvc = pgwservices.New(deps.DB)
	registerEventHandlers()
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	pluginhandlers.RegisterRoutes(p.authSvc, p.logSvc, admin, api, GetGateway)
	admin.GET("/plugins/payment_gateway/health", pluginhandlers.HealthHandler)
	_ = router
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {

	cmd := &cobra.Command{
		Use:   "payment_gateway:hello",
		Short: "hello from payment_gateway",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin payment_gateway\\n")
		},
	}
	return []*cobra.Command{cmd}
}
