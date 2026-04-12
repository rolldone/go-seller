package review

import (
	"fmt"

	"go_framework/internal/plugins"
	pluginhandlers "go_framework/plugins/review/handlers"
	pluginservices "go_framework/plugins/review/services"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin review provides buyer review endpoints.
type Plugin struct {
	service *pluginservices.ReviewService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "review" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = pluginservices.New(deps.DB, deps.Store)
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.service == nil {
		return fmt.Errorf("review: service not registered")
	}
	handler := pluginhandlers.NewReviewHandler(p.service)
	handler.RegisterRoutes(admin, api)
	_ = router
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {

	cmd := &cobra.Command{
		Use:   "review:hello",
		Short: "hello from review",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin review\\n")
		},
	}
	return []*cobra.Command{cmd}
}
