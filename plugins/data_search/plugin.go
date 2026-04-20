package data_search

import (
	"fmt"
	"strings"

	internaldb "go_framework/internal/db"
	"go_framework/internal/plugins"
	pluginhandlers "go_framework/plugins/data_search/handlers"
	pluginservices "go_framework/plugins/data_search/services"
	pluginregistry "go_framework/plugins/plugin_registry"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	"gorm.io/gorm"
)

// Plugin data_search provides full-text search over products, businesses and categories.
type Plugin struct {
	service *pluginservices.SearchService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "data_search" }

func (p *Plugin) ensureService(requireDB bool) error {
	if p.service != nil && (!requireDB || p.service.DB != nil) {
		return nil
	}

	var gdb *gorm.DB
	if requireDB {
		var err error
		gdb, err = internaldb.GetGormDB()
		if err != nil {
			return fmt.Errorf("data_search: connect database: %w", err)
		}
	}

	p.service = pluginservices.New(gdb)
	return nil
}

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = pluginservices.New(deps.DB)
	pluginregistry.RegisterSearchIndexerProvider(p.service)
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.service == nil {
		return fmt.Errorf("data_search: service not registered; call RegisterServices first")
	}

	admin.GET("/plugins/data_search/health", pluginhandlers.HealthHandler)
	admin.POST("/plugins/data_search/reindex", pluginhandlers.NewReindexHandler(p.service).Reindex)

	searchHandler := pluginhandlers.NewSearchHandler(p.service)
	api.GET("/search", searchHandler.Search)

	_ = router
	return nil
}

func (p *Plugin) Seed() error { return nil }

func (p *Plugin) ConsoleCommands() []*cobra.Command {
	reindexScope := "all"
	reindexID := ""

	reindexCmd := &cobra.Command{
		Use:   "data_search:reindex",
		Short: "rebuild search_index from catalog data",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := p.ensureService(true); err != nil {
				return err
			}
			scope := strings.ToLower(strings.TrimSpace(reindexScope))
			if reindexID != "" {
				if scope == "all" {
					return fmt.Errorf("--id requires --scope to be product, business, or category")
				}
				if err := p.service.ReindexOne(cmd.Context(), p.service.DB, scope, reindexID); err != nil {
					return err
				}
				cmd.Printf("reindexed %s %s\n", scope, reindexID)
				return nil
			}
			if scope == "" || scope == "all" {
				if err := p.service.ReindexAll(cmd.Context(), p.service.DB); err != nil {
					return err
				}
				cmd.Println("search index rebuilt for all catalog entities")
				return nil
			}
			if err := p.service.ReindexScope(cmd.Context(), p.service.DB, scope); err != nil {
				return err
			}
			cmd.Printf("search index rebuilt for %s entities\n", scope)
			return nil
		},
	}
	reindexCmd.Flags().StringVar(&reindexScope, "scope", "all", "all, product, business, or category")
	reindexCmd.Flags().StringVar(&reindexID, "id", "", "optional entity id for single-item reindex")

	helloCmd := &cobra.Command{
		Use:   "data_search:hello",
		Short: "hello from data_search",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin data_search\n")
		},
	}

	return []*cobra.Command{helloCmd, reindexCmd}
}
