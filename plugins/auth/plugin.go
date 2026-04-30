package auth

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"go_framework/internal/plugins"
	pluginconsole "go_framework/plugins/auth/console"
	pluginhandlers "go_framework/plugins/auth/handlers"
	pluginservices "go_framework/plugins/auth/services"
	pluginregistry "go_framework/plugins/plugin_registry"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

// Plugin Auth provides a minimal scaffold.
type Plugin struct {
	service *pluginservices.AuthService
}

// New returns a new plugin instance.
func New() plugins.Plugin { return &Plugin{} }

func (p *Plugin) ID() string { return "auth" }

func (p *Plugin) RegisterServices(deps plugins.ServiceDeps) error {
	p.service = pluginservices.New(deps.DB)
	// register permission provider so other plugins can obtain permission middleware
	pluginregistry.RegisterPermissionProvider(&authPermissionProvider{svc: p.service})
	return nil
}

func (p *Plugin) RegisterMiddleware() []plugins.MiddlewareDescriptor { return nil }

func (p *Plugin) RegisterRoutes(router *gin.Engine, admin *gin.RouterGroup, api *gin.RouterGroup) error {
	if p.service == nil {
		return fmt.Errorf("auth: service not registered; call RegisterServices first")
	}

	authHandler := pluginhandlers.NewAuthHandler(p.service)
	adminHandler := pluginhandlers.NewAdminHandler(p.service)
	userHandler := pluginhandlers.NewUserHandler(p.service)
	customerHandler := pluginhandlers.NewCustomerHandler(p.service)
	memberAuthHandler := pluginhandlers.NewMemberAuthHandler(p.service)
	memberSetupHandler := pluginhandlers.NewMemberSetupHandler(p.service)
	memberProfileHandler := pluginhandlers.NewMemberProfileHandler(p.service)
	addressHandler := pluginhandlers.NewCustomerAddressHandler(p.service)
	rbacHandler := pluginhandlers.NewRBACHandler(p.service)

	admin.GET("/plugins/auth/health", pluginhandlers.HealthHandler)

	adminAuth := admin.Group("/auth")
	loginLimiter := pluginhandlers.NewIPRateLimiter(getEnvInt("AUTH_LOGIN_RATE_LIMIT", 5), time.Minute)
	forgotLimiter := pluginhandlers.NewIPRateLimiter(getEnvInt("AUTH_FORGOT_RATE_LIMIT", 3), time.Minute)
	adminAuth.POST("/login", loginLimiter, authHandler.Login)
	adminAuth.GET("/me", pluginhandlers.RequireAdminJWT(), authHandler.Me)
	adminAuth.POST("/forgot-password", forgotLimiter, authHandler.ForgotPassword)
	adminAuth.POST("/reset-password", authHandler.ResetPassword)
	adminAuth.POST("/logout", pluginhandlers.RequireAdminJWT(), authHandler.Logout)

	customerAuth := api.Group("/customer/auth")
	customerAuth.POST("/register", customerHandler.Register)
	customerAuth.POST("/login", loginLimiter, customerHandler.Login)
	customerAuth.POST("/forgot-password", forgotLimiter, customerHandler.ForgotPassword)
	customerAuth.POST("/reset-password", customerHandler.ResetPassword)
	customerAuth.GET("/me", pluginhandlers.RequireCustomerJWT(), customerHandler.Me)
	customerAuth.GET("/addresses", pluginhandlers.RequireCustomerJWT(), addressHandler.MeList)
	customerAuth.POST("/addresses", pluginhandlers.RequireCustomerJWT(), addressHandler.MeCreate)
	customerAuth.GET("/addresses/:address_id", pluginhandlers.RequireCustomerJWT(), addressHandler.MeGetByID)
	customerAuth.PUT("/addresses/:address_id", pluginhandlers.RequireCustomerJWT(), addressHandler.MeUpdate)
	customerAuth.DELETE("/addresses/:address_id", pluginhandlers.RequireCustomerJWT(), addressHandler.MeDelete)
	customerAuth.POST("/addresses/:address_id/set-primary", pluginhandlers.RequireCustomerJWT(), addressHandler.MeSetPrimary)
	customerAuth.POST("/logout", customerHandler.Logout)

	member := api.Group("/member")
	memberAuth := api.Group("/member/auth")
	memberAuth.POST("/login", loginLimiter, memberAuthHandler.Login)
	memberAuth.GET("/me", memberAuthHandler.Me)
	memberAuth.POST("/forgot-password", forgotLimiter, memberAuthHandler.ForgotPassword)
	memberAuth.POST("/reset-password", memberAuthHandler.ResetPassword)
	memberAuth.GET("/verify", memberAuthHandler.VerifyEmail)
	memberAuth.POST("/team/invites/setup", memberSetupHandler.SetupFromInvite)
	member.POST("/setup", memberSetupHandler.Setup)

	memberProfile := api.Group("/member/profile")
	memberProfile.Use(pluginhandlers.RequireMemberJWT())
	memberProfile.GET("", memberProfileHandler.GetProfile)
	memberProfile.PUT("", memberProfileHandler.UpdateProfile)
	memberProfile.PUT("/password", memberProfileHandler.ChangePassword)

	adminAdmins := admin.Group("/admins")
	adminAdmins.Use(pluginhandlers.RequireAdminJWT())
	adminAdmins.POST("", adminHandler.Create)
	adminAdmins.GET("", adminHandler.List)
	adminAdmins.GET("/:id", adminHandler.GetByID)
	adminAdmins.PUT("/:id", adminHandler.Update)
	adminAdmins.PATCH("/:id/change-password", adminHandler.ChangePassword)
	adminAdmins.POST("/:id/restore", adminHandler.Restore)
	adminAdmins.DELETE("/:id", adminHandler.Delete)

	adminUsers := admin.Group("/users")
	adminUsers.Use(pluginhandlers.RequireAdminJWT())
	adminUsers.POST("", userHandler.Create)
	adminUsers.GET("", userHandler.List)
	adminUsers.GET("/:id", userHandler.GetByID)
	adminUsers.PUT("/:id", userHandler.Update)
	adminUsers.POST("/:id/ban", userHandler.Ban)
	adminUsers.POST("/:id/unban", userHandler.Unban)
	adminUsers.POST("/:id/restore", userHandler.Restore)
	adminUsers.DELETE("/:id", userHandler.Delete)

	adminCustomers := admin.Group("/customers")
	adminCustomers.Use(pluginhandlers.RequireAdminJWT())
	adminCustomers.POST("", customerHandler.Create)
	adminCustomers.GET("", customerHandler.List)
	adminCustomers.GET("/:id", customerHandler.GetByID)
	adminCustomers.PUT("/:id", customerHandler.Update)
	adminCustomers.GET("/:id/addresses", addressHandler.AdminList)
	adminCustomers.POST("/:id/addresses", addressHandler.AdminCreate)
	adminCustomers.GET("/:id/addresses/:address_id", addressHandler.AdminGetByID)
	adminCustomers.PUT("/:id/addresses/:address_id", addressHandler.AdminUpdate)
	adminCustomers.DELETE("/:id/addresses/:address_id", addressHandler.AdminDelete)
	adminCustomers.POST("/:id/addresses/:address_id/set-primary", addressHandler.AdminSetPrimary)
	adminCustomers.POST("/:id/ban", customerHandler.Ban)
	adminCustomers.POST("/:id/unban", customerHandler.Unban)
	adminCustomers.POST("/:id/restore", customerHandler.Restore)
	adminCustomers.DELETE("/:id", customerHandler.Delete)

	adminRoles := admin.Group("/roles")
	adminRoles.Use(pluginhandlers.RequireAdminJWT())
	adminRoles.GET("", pluginhandlers.RequirePermission(p.service, "roles.view"), rbacHandler.ListRoles)
	adminRoles.GET("/:id", pluginhandlers.RequirePermission(p.service, "roles.view"), rbacHandler.GetRole)
	adminRoles.POST("", pluginhandlers.RequirePermission(p.service, "roles.manage"), rbacHandler.CreateRole)
	adminRoles.PUT("/:id", pluginhandlers.RequirePermission(p.service, "roles.manage"), rbacHandler.UpdateRole)
	adminRoles.DELETE("/:id", pluginhandlers.RequirePermission(p.service, "roles.manage"), rbacHandler.DeleteRole)
	adminRoles.POST("/:id/assign", pluginhandlers.RequirePermission(p.service, "roles.manage"), rbacHandler.AssignRole)
	adminRoles.POST("/:id/unassign", pluginhandlers.RequirePermission(p.service, "roles.manage"), rbacHandler.UnassignRole)
	adminRoles.GET("/:id/assignments", pluginhandlers.RequirePermission(p.service, "roles.view"), rbacHandler.ListRoleAssignments)

	adminPermissions := admin.Group("/permissions")
	adminPermissions.Use(pluginhandlers.RequireAdminJWT())
	adminPermissions.GET("", pluginhandlers.RequirePermission(p.service, "roles.view"), rbacHandler.ListPermissions)

	_ = api
	return nil
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func (p *Plugin) Seed() error {
	if p.service == nil {
		return fmt.Errorf("auth: service not registered; call RegisterServices first")
	}
	return p.service.SeedDefaultRBAC(context.Background())
}

func (p *Plugin) ConsoleCommands() []*cobra.Command {
	// return admin console commands (creates admin via console)
	cmds := pluginconsole.AdminCommands()
	cmds = append(cmds, pluginconsole.S2SCommands()...)
	// keep a small hello command for quick checks
	hello := &cobra.Command{
		Use:   "auth:hello",
		Short: "hello from auth",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin auth\\n")
		},
	}
	return append(cmds, hello)
}

// authPermissionProvider adapts the AuthService to the plugin_registry.PermissionProvider interface.
type authPermissionProvider struct {
	svc *pluginservices.AuthService
}

func (a *authPermissionProvider) RequirePermission(permission string) gin.HandlerFunc {
	return pluginhandlers.RequirePermission(a.svc, permission)
}
