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
	reviewService    *pluginservices.ReviewService
	complaintService *pluginservices.ComplaintService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "review" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.reviewService = pluginservices.New(deps.DB, deps.Store)
	p.complaintService = pluginservices.NewComplaintService(deps.DB)
	p.complaintService.SetReminderRunner(pluginservices.NewComplaintReminderRunner(p.complaintService))
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.reviewService == nil || p.complaintService == nil {
		return fmt.Errorf("review: service not registered")
	}
	reviewHandler := pluginhandlers.NewReviewHandler(p.reviewService)
	reviewHandler.RegisterRoutes(admin, api)
	complaintHandler := pluginhandlers.NewComplaintHandler(p.complaintService)
	complaintHandler.RegisterRoutes(admin, api)
	if err := p.complaintService.StartReminderLoop(); err != nil {
		return err
	}
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
