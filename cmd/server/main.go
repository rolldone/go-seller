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
	"os"
	"path/filepath"
	"strconv"
	"syscall"

	"go_framework/internal/app"
	"go_framework/internal/plugins"
	authplugin "go_framework/plugins/auth"
	catalogplugin "go_framework/plugins/catalog"
	datasearchplugin "go_framework/plugins/data_search"
	financeplugin "go_framework/plugins/finance"
	marketingplugin "go_framework/plugins/marketing"
	notificationplugin "go_framework/plugins/notification"
	orderplugin "go_framework/plugins/order"
	paymentgatewayplugin "go_framework/plugins/payment_gateway"
	reviewplugin "go_framework/plugins/review"
	settingplugin "go_framework/plugins/setting"
)

// main is a thin entrypoint; core boot logic lives in internal/app.
// Register custom plugins here if needed, similar to Laravel's bootstrap/app.php.
func main() {
	// Set permissive umask so created files/dirs are group-writable by default
	syscall.Umask(0o002)

	// Write PID file to repository root (overwrites pid.txt)
	if err := writePidToRepoRoot("pid.txt"); err != nil {
		log.Printf("warning: failed to write pid.txt: %v", err)
	}

	err := app.Run(app.Options{
		RegisterPlugins: func() {
			// Example: register user plugins here
			// plugins.RegisterPlugins([]plugins.Plugin{myPlugin.New()})
			// plugins.RegisterPlugins([]plugins.Plugin{suppliers.New(), test_plugin.New()})
			plugins.RegisterPlugins([]plugins.Plugin{authplugin.New(), catalogplugin.New(), datasearchplugin.New(), financeplugin.New(), marketingplugin.New(), orderplugin.New(), paymentgatewayplugin.New(), reviewplugin.New(), settingplugin.New(), notificationplugin.New()})
		},
	})
	if err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}

// writePidToRepoRoot writes the current process PID into filename located in the
// repository root (it searches parent directories for go.mod). If go.mod is not
// found it falls back to the current working directory.
func writePidToRepoRoot(filename string) error {
	wd, err := os.Getwd()
	if err != nil {
		return err
	}
	dir := wd
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			// reached filesystem root, fallback to cwd
			dir = wd
			break
		}
		dir = parent
	}
	pid := strconv.Itoa(os.Getpid()) + "\n"
	path := filepath.Join(dir, filename)
	return os.WriteFile(path, []byte(pid), 0644)
}
