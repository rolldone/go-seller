package main

import (
	"syscall"

	"go_framework/internal/console"
	"go_framework/internal/plugins"
	authplugin "go_framework/plugins/auth"
	catalogplugin "go_framework/plugins/catalog"
	notificationplugin "go_framework/plugins/notification"
	orderplugin "go_framework/plugins/order"
	reviewplugin "go_framework/plugins/review"
	settingplugin "go_framework/plugins/setting"
)

func main() {
	// Ensure console commands create group-writable files by default
	syscall.Umask(0o002)
	// To register additional plugins and their console commands, use:
	// console.RegisterAdditionalPlugins([]plugins.Plugin{plugin.New()})
	console.RegisterAdditionalPlugins([]plugins.Plugin{authplugin.New(), catalogplugin.New(), orderplugin.New(), reviewplugin.New(), settingplugin.New(), notificationplugin.New()})
	console.Execute()
}
