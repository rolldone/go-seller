package notification

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	internaldb "go_framework/internal/db"
	"go_framework/internal/plugins"
	uuid "go_framework/internal/uuid"
	pluginhandlers "go_framework/plugins/notification/handlers"
	pluginservices "go_framework/plugins/notification/services"
	pluginregistry "go_framework/plugins/plugin_registry"
	settingmodels "go_framework/plugins/setting/models"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	"gorm.io/gorm"
)

// Plugin notification provides a minimal scaffold.
type Plugin struct {
	service *pluginservices.Service
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "notification" }

func (p *Plugin) ensureService(requireDB bool) error {
	if p.service != nil && (!requireDB || p.service.DB != nil) {
		return nil
	}

	var gdb *gorm.DB
	if requireDB {
		var err error
		gdb, err = internaldb.GetGormDB()
		if err != nil {
			return fmt.Errorf("notification: connect database: %w", err)
		}
	}

	p.service = pluginservices.New(gdb)
	return nil
}

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = pluginservices.New(deps.DB)
	// register provider so core can delegate notification dispatching
	pluginregistry.RegisterNotificationProvider(p.service)
	// Auto-seed notification defaults in background unless explicitly disabled.
	if strings.ToLower(strings.TrimSpace(os.Getenv("AUTO_SEED"))) != "false" {
		go func() {
			if err := p.service.SeedDefaults("plugins/notification/defaults.json"); err != nil {
				log.Printf("[WARN] notification plugin seed failed: %v", err)
			}
		}()
	}
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if err := p.ensureService(true); err != nil {
		return err
	}
	admin.GET("/plugins/notification/health", pluginhandlers.HealthHandler)
	admin.POST("/notifications/:id/test", pluginhandlers.TestNotificationHandler(p.service))
	return nil
}

func (p *Plugin) Seed() error {
	if err := p.ensureService(true); err != nil {
		return err
	}
	return p.service.SeedDefaults("plugins/notification/defaults.json")
}

func (p *Plugin) ConsoleCommands() []*cobra.Command {
	helloCmd := &cobra.Command{
		Use:   "notification:hello",
		Short: "hello from notification",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin notification\\n")
		},
	}

	seedCmd := &cobra.Command{
		Use:   "notification:seed",
		Short: "seed default notification templates into settings",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := p.ensureService(true); err != nil {
				return err
			}
			if err := p.Seed(); err != nil {
				return err
			}
			cmd.Println("notification defaults seeded")
			return nil
		},
	}

	var toEmail string
	var subject string
	var body string
	testCmd := &cobra.Command{
		Use:   "notification:test-email",
		Short: "send a test email using SMTP config from .env",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := p.ensureService(false); err != nil {
				return err
			}
			if strings.TrimSpace(toEmail) == "" {
				toEmail = os.Getenv("SMTP_FROM_EMAIL")
				if strings.TrimSpace(toEmail) == "" {
					toEmail = os.Getenv("SMTP_FROM")
				}
			}
			if strings.TrimSpace(toEmail) == "" {
				return fmt.Errorf("recipient email is required; pass --to or set SMTP_FROM/SMTP_FROM_EMAIL")
			}
			if err := p.service.SendTestEmail(toEmail, subject, body); err != nil {
				return err
			}
			cmd.Printf("test email sent to %s\n", toEmail)
			return nil
		},
	}
	testCmd.Flags().StringVar(&toEmail, "to", "", "recipient email address")
	testCmd.Flags().StringVar(&subject, "subject", "", "email subject")
	testCmd.Flags().StringVar(&body, "body", "", "email body")

	var apply bool
	cleanupCmd := &cobra.Command{
		Use:   "notification:cleanup-templates",
		Short: "migrate legacy notification template keys to member-facing keys",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := p.ensureService(true); err != nil {
				return err
			}
			legacyToNew := map[string]string{
				"notifications.team_member_invited_admin.id":   "notifications.team_member_invited_member.id",
				"notifications.team_member_invited_admin.en":   "notifications.team_member_invited_member.en",
				"notifications.team_member_suspended_admin.id": "notifications.team_member_suspended_member.id",
				"notifications.team_member_suspended_admin.en": "notifications.team_member_suspended_member.en",
			}
			legacyKeys := make([]string, 0, len(legacyToNew))
			for legacyKey := range legacyToNew {
				legacyKeys = append(legacyKeys, legacyKey)
			}

			var rows []settingmodels.Setting
			if err := p.service.DB.Order("key asc").Where("scope = ? AND key IN ?", "global", legacyKeys).Find(&rows).Error; err != nil {
				return err
			}
			if len(rows) == 0 {
				cmd.Println("no legacy notification template keys found")
				return nil
			}

			for _, row := range rows {
				targetKey := legacyToNew[row.Key]
				if strings.TrimSpace(targetKey) == "" {
					continue
				}
				cmd.Printf("%s -> %s\n", row.Key, targetKey)
			}

			if !apply {
				cmd.Println("dry run only; pass --apply to move data")
				return nil
			}

			now := time.Now()
			return p.service.DB.Transaction(func(tx *gorm.DB) error {
				for _, row := range rows {
					targetKey := legacyToNew[row.Key]
					if strings.TrimSpace(targetKey) == "" {
						continue
					}

					var target settingmodels.Setting
					err := tx.Where("scope = ? AND key = ?", row.Scope, targetKey).First(&target).Error
					if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
						return err
					}

					if errors.Is(err, gorm.ErrRecordNotFound) {
						created := settingmodels.Setting{
							ID:          uuid.NewString(),
							Scope:       row.Scope,
							Key:         targetKey,
							Value:       row.Value,
							Description: row.Description,
							CreatedAt:   now,
							UpdatedAt:   now,
						}
						if err := tx.Create(&created).Error; err != nil {
							return err
						}
					}

					if err := tx.Delete(&settingmodels.Setting{}, "scope = ? AND key = ?", row.Scope, row.Key).Error; err != nil {
						return err
					}
				}
				return nil
			})
		},
	}
	cleanupCmd.Flags().BoolVar(&apply, "apply", false, "actually migrate legacy keys instead of dry-run")

	return []*cobra.Command{helloCmd, seedCmd, testCmd, cleanupCmd}
}
