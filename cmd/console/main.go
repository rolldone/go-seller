package main

import (
	"syscall"

	"go_framework/internal/console"
	"go_framework/internal/plugins"
	authplugin "go_framework/plugins/auth"
	catalogplugin "go_framework/plugins/catalog"
	datasearchplugin "go_framework/plugins/data_search"
	financeplugin "go_framework/plugins/finance"
	maintenanceplugin "go_framework/plugins/maintenance"
	marketingplugin "go_framework/plugins/marketing"
	notificationplugin "go_framework/plugins/notification"
	orderplugin "go_framework/plugins/order"
	paymentgatewayplugin "go_framework/plugins/payment_gateway"
	reviewplugin "go_framework/plugins/review"
	settingplugin "go_framework/plugins/setting"
)

func main() {
	// Ensure console commands create group-writable files by default
	syscall.Umask(0o002)
	// To register additional plugins and their console commands, use:
	// console.RegisterAdditionalPlugins([]plugins.Plugin{plugin.New()})
	console.RegisterAdditionalPlugins([]plugins.Plugin{authplugin.New(), catalogplugin.New(), datasearchplugin.New(), financeplugin.New(), marketingplugin.New(), maintenanceplugin.New(), orderplugin.New(), paymentgatewayplugin.New(), reviewplugin.New(), settingplugin.New(), notificationplugin.New()})
	console.Execute()
}
