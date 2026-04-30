package finance

import (
	"fmt"

	"go_framework/internal/plugins"
	authhandlers "go_framework/plugins/auth/handlers"
	pluginhandlers "go_framework/plugins/finance/handlers"
	pluginservices "go_framework/plugins/finance/services"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin finance provides finance-related features.
type Plugin struct {
	service *pluginservices.FinanceService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "finance" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = pluginservices.New(deps.DB, deps.Store)
	registerEventHandlers()
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.service == nil {
		return fmt.Errorf("finance: service not registered; call RegisterServices first")
	}
	admin.GET("/plugins/finance/health", pluginhandlers.HealthHandler)

	// Member routes (require member JWT)
	memberCatalog := api.Group("/member")
	memberCatalog.Use(authhandlers.RequireMemberJWT())
	payoutHandler := pluginhandlers.NewPayoutHandler(p.service)
	memberBusiness := memberCatalog.Group("/businesses/:business_id")
	memberBusiness.GET("/bank-accounts", payoutHandler.MemberList)
	memberBusiness.POST("/bank-accounts", payoutHandler.MemberCreate)
	memberBusiness.PUT("/bank-accounts/:id", payoutHandler.MemberUpdate)
	memberBusiness.DELETE("/bank-accounts/:id", payoutHandler.MemberDelete)
	memberBusiness.POST("/payouts", pluginhandlers.NewPayoutRequestHandler(p.service).MemberCreate)
	memberBusiness.GET("/payouts", pluginhandlers.NewPayoutRequestHandler(p.service).MemberList)
	memberBusiness.GET("/payouts/:id", pluginhandlers.NewPayoutRequestHandler(p.service).MemberGetByID)
	memberCatalog.GET("/bank-accounts", payoutHandler.MemberList)
	memberCatalog.POST("/bank-accounts", payoutHandler.MemberCreate)
	memberCatalog.PUT("/bank-accounts/:id", payoutHandler.MemberUpdate)
	memberCatalog.DELETE("/bank-accounts/:id", payoutHandler.MemberDelete)

	// Payout requests (member)
	payoutRequestHandler := pluginhandlers.NewPayoutRequestHandler(p.service)
	memberCatalog.POST("/payouts", payoutRequestHandler.MemberCreate)
	memberCatalog.GET("/payouts", payoutRequestHandler.MemberList)
	memberCatalog.GET("/payouts/:id", payoutRequestHandler.MemberGetByID)

	_ = router
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {
	cmd := &cobra.Command{
		Use:   "finance:hello",
		Short: "hello from finance",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin finance\n")
		},
	}
	return []*cobra.Command{cmd}
}
