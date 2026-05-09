// Package payment_gateway registers the payment gateway adapter registry and webhook routes.
package payment_gateway

import (
	"go_framework/internal/plugins"
	orderservices "go_framework/plugins/order/services"
	pgwhandlers "go_framework/plugins/payment_gateway/handlers"
	"go_framework/plugins/payment_gateway/pgwtypes"
	pgwservices "go_framework/plugins/payment_gateway/services"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	"gorm.io/gorm"
)

// Plugin payment_gateway wires up all payment gateway adapters and exposes webhook endpoints.
type Plugin struct {
	registry       *pgwtypes.Registry
	db             *gorm.DB
	paymentService *orderservices.PaymentService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "payment_gateway" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.db = deps.DB

	// Build registry and register all adapters
	p.registry = pgwtypes.NewRegistry()
	p.registry.Register(pgwservices.NewMidtransAdapter())
	p.registry.Register(pgwservices.NewXenditAdapter())
	p.registry.Register(pgwservices.NewDuitkuAdapter())
	p.registry.Register(pgwservices.NewTripayAdapter())
	p.registry.Register(pgwservices.NewIPaymuAdapter())

	// Expose registry to the order plugin's payment service
	p.paymentService = orderservices.NewPaymentServiceWithRegistry(deps.DB, deps.Store, p.registry)

	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	pgwhandlers.RegisterWebhookRoutes(p.paymentService, p.registry, router)
	_ = admin
	_ = api
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command { return nil }
