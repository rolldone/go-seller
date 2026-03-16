package main

import (
	"syscall"

	"go_framework/internal/console"
	"go_framework/internal/plugins"
	authplugin "go_framework/plugins/auth"
	catalogplugin "go_framework/plugins/catalog"
	orderplugin "go_framework/plugins/order"
	settingplugin "go_framework/plugins/setting"
)

func main() {
	// Ensure console commands create group-writable files by default
	syscall.Umask(0o002)
	// To register additional plugins and their console commands, use:
	// console.RegisterAdditionalPlugins([]plugins.Plugin{plugin.New()})
	console.RegisterAdditionalPlugins([]plugins.Plugin{authplugin.New(), catalogplugin.New(), orderplugin.New(), settingplugin.New()})
	console.Execute()
}
