package seed_data

import (
	"context"
	"fmt"

	"go_framework/internal/plugins"
	pluginhandlers "go_framework/plugins/seed_data/handlers"
	seedservices "go_framework/plugins/seed_data/services"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin seed_data provides a minimal scaffold.
type Plugin struct{}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "seed_data" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	_ = deps
	registerEventHandlers()
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	admin.GET("/plugins/seed_data/health", pluginhandlers.HealthHandler)
	_ = router
	_ = api
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {

	hello := &cobra.Command{
		Use:   "seed_data:hello",
		Short: "hello from seed_data",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin seed_data\\n")
		},
	}

	var file string
	importCmd := &cobra.Command{
		Use:   "seed_data:import-categories [file]",
		Short: "Import categories from a JSON file (optional file)",
		Run: func(cmd *cobra.Command, args []string) {
			// allow positional arg or --file; default to plugin data file
			if file == "" && len(args) > 0 {
				file = args[0]
			}
			if file == "" {
				file = "plugins/seed_data/data/categories.json"
			}
			if err := seedservices.ImportCategoriesFromFile(context.Background(), file); err != nil {
				fmt.Printf("import failed: %v\n", err)
				return
			}
			fmt.Println("import completed")
		},
	}
	importCmd.Flags().StringVar(&file, "file", "", "path to categories json (optional)")

	return []*cobra.Command{hello, importCmd}
}
