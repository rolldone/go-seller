// @title Umahstore Admin API
// @version 1.0
// @description Admin API for Umahstore - auto-generated swagger docs
// @termsOfService http://example.com/terms/
// @contact.name API Support
// @contact.url http://www.example.com/support
// @contact.email support@example.com
// @license.name MIT
// @license.url https://opensource.org/licenses/MIT
// @host localhost:8080
// @BasePath /admin
package main

import (
	"log"
	"syscall"

	"go_framework/internal/app"
	"go_framework/internal/plugins"
	authplugin "go_framework/plugins/auth"
	catalogplugin "go_framework/plugins/catalog"
	notificationplugin "go_framework/plugins/notification"
	orderplugin "go_framework/plugins/order"
	reviewplugin "go_framework/plugins/review"
	settingplugin "go_framework/plugins/setting"
)

// main is a thin entrypoint; core boot logic lives in internal/app.
// Register custom plugins here if needed, similar to Laravel's bootstrap/app.php.
func main() {
	// Set permissive umask so created files/dirs are group-writable by default
	syscall.Umask(0o002)

	err := app.Run(app.Options{
		RegisterPlugins: func() {
			// Example: register user plugins here
			// plugins.RegisterPlugins([]plugins.Plugin{myPlugin.New()})
			// plugins.RegisterPlugins([]plugins.Plugin{suppliers.New(), test_plugin.New()})
			plugins.RegisterPlugins([]plugins.Plugin{authplugin.New(), catalogplugin.New(), orderplugin.New(), reviewplugin.New(), settingplugin.New(), notificationplugin.New()})
		},
	})
	if err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
