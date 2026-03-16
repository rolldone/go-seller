package setting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	pluginhandlers "go_framework/plugins/setting/handlers"
	pluginservices "go_framework/plugins/setting/services"

	"go_framework/internal/plugins"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin setting provides a minimal scaffold.
type Plugin struct {
	service *pluginservices.Service
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "setting" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = pluginservices.New(deps.DB)
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.service == nil {
		return fmt.Errorf("setting: service not registered; call RegisterServices first")
	}

	h := pluginhandlers.NewSettingHandler(p.service)
	admin.GET("/plugins/setting/health", pluginhandlers.HealthHandler)
	admin.GET("/settings", h.List)
	admin.GET("/settings/:key", h.Get)
	admin.PUT("/settings/:key", h.Upsert)
	admin.DELETE("/settings/:key", h.Delete)
	return nil
}

func (p *Plugin) Seed() error {
	if p.service == nil {
		return fmt.Errorf("setting: service not registered; call RegisterServices first")
	}

	// read defaults file
	data, err := os.ReadFile("plugins/setting/defaults.json")
	if err != nil {
		// no defaults file is not fatal
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	var entries []struct {
		Key         string          `json:"key"`
		Scope       string          `json:"scope"`
		Value       json.RawMessage `json:"value"`
		Description *string         `json:"description"`
	}
	if err := json.Unmarshal(data, &entries); err != nil {
		return err
	}

	ctx := context.Background()
	for _, e := range entries {
		// check existence via List to avoid direct GetByKey usage
		items, _, err := p.service.List(ctx, pluginservices.ListFilter{Scope: e.Scope, Query: e.Key, Page: 1, Limit: 1})
		if err != nil {
			return err
		}
		exists := false
		if len(items) > 0 {
			// ensure exact key match
			if items[0].Key == e.Key && items[0].Scope == e.Scope {
				exists = true
			}
		}
		if !exists {
			if _, err := p.service.Upsert(ctx, e.Scope, e.Key, []byte(e.Value), e.Description); err != nil {
				return err
			}
		}
	}

	return nil
}

func (p *Plugin) ConsoleCommands() []*cobra.Command {

	cmd := &cobra.Command{
		Use:   "setting:hello",
		Short: "hello from setting",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin setting\\n")
		},
	}
	return []*cobra.Command{cmd}
}
