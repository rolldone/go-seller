package console

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/bcrypt"

	"go_framework/internal/db"
	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	"go_framework/plugins/auth/services"
)

var adminUsername string
var adminEmail string
var adminPassword string
var adminActivate bool
var adminNoActivate bool
var adminBanReason string
var adminBanUntil string
var adminBannedBy string

// AdminCommands returns console commands for admin management.
func AdminCommands() []*cobra.Command {
	adminCmd := &cobra.Command{Use: "admin", Short: "Admin management commands"}

	adminCreateCmd := &cobra.Command{
		Use:   "create",
		Short: "Create an admin user",
		Run: func(cmd *cobra.Command, args []string) {
			if adminPassword == "" {
				fmt.Print("Password: ")
				fmt.Scanln(&adminPassword)
			}
			if err := createAdmin(adminUsername, adminEmail, adminPassword); err != nil {
				log.Fatalf("failed to create admin: %v", err)
			}
			fmt.Println("admin created")
		},
	}

	adminGetCmd := &cobra.Command{
		Use:   "get",
		Short: "Get an admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			a, err := getAdminByEmail(adminEmail)
			if err != nil {
				log.Fatalf("failed to get admin: %v", err)
			}
			fmt.Printf("ID: %s\nUsername: %s\nEmail: %s\nCreatedAt: %v\n", a.ID, a.Username, a.Email, a.CreatedAt)
		},
	}

	adminDeleteCmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete an admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			n, err := deleteAdminByEmail(adminEmail)
			if err != nil {
				log.Fatalf("failed to delete admin: %v", err)
			}
			if n == 0 {
				fmt.Println("no admin found for given email")
			} else {
				fmt.Printf("deleted %d admin(s)\n", n)
			}
		},
	}

	adminCreateCmd.Flags().StringVar(&adminUsername, "username", "", "admin username")
	adminCreateCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminCreateCmd.Flags().StringVar(&adminPassword, "password", "", "admin password")
	adminCreateCmd.Flags().BoolVar(&adminActivate, "activate", true, "activate admin on create")
	adminCreateCmd.Flags().BoolVar(&adminNoActivate, "no-activate", false, "do not activate admin on create (overrides --activate)")
	adminCreateCmd.MarkFlagRequired("username")
	adminCreateCmd.MarkFlagRequired("email")

	adminGetCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminGetCmd.MarkFlagRequired("email")

	adminDeleteCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminDeleteCmd.MarkFlagRequired("email")

	adminPasswdCmd := &cobra.Command{
		Use:   "passwd",
		Short: "Update admin password by email",
		Run: func(cmd *cobra.Command, args []string) {
			if adminPassword == "" {
				fmt.Print("Password: ")
				fmt.Scanln(&adminPassword)
			}
			if err := updateAdminPassword(adminEmail, adminPassword); err != nil {
				log.Fatalf("failed to update password: %v", err)
			}
			fmt.Println("password updated")
		},
	}

	adminPasswdCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminPasswdCmd.Flags().StringVar(&adminPassword, "password", "", "new password")
	adminPasswdCmd.MarkFlagRequired("email")

	adminRestoreCmd := &cobra.Command{
		Use:   "restore",
		Short: "Restore a soft-deleted admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			n, err := restoreAdminByEmail(adminEmail)
			if err != nil {
				log.Fatalf("failed to restore admin: %v", err)
			}
			if n == 0 {
				fmt.Println("no admin found to restore for given email")
			} else {
				fmt.Printf("restored %d admin(s)\n", n)
			}
		},
	}

	adminRestoreCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminRestoreCmd.MarkFlagRequired("email")

	adminActivateCmd := &cobra.Command{
		Use:   "activate",
		Short: "Activate an admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			n, err := activateAdminByEmail(adminEmail)
			if err != nil {
				log.Fatalf("failed to activate admin: %v", err)
			}
			if n == 0 {
				fmt.Println("no admin found for given email")
			} else {
				fmt.Printf("activated %d admin(s)\n", n)
			}
		},
	}

	adminActivateCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminActivateCmd.MarkFlagRequired("email")

	adminDeactivateCmd := &cobra.Command{
		Use:   "deactivate",
		Short: "Deactivate an admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			n, err := deactivateAdminByEmail(adminEmail)
			if err != nil {
				log.Fatalf("failed to deactivate admin: %v", err)
			}
			if n == 0 {
				fmt.Println("no admin found for given email")
			} else {
				fmt.Printf("deactivated %d admin(s)\n", n)
			}
		},
	}

	adminDeactivateCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminDeactivateCmd.MarkFlagRequired("email")

	adminBanCmd := &cobra.Command{
		Use:   "ban",
		Short: "Ban an admin by email with optional reason and until time",
		Run: func(cmd *cobra.Command, args []string) {
			n, err := banAdminByEmail(adminEmail, adminBanReason, adminBanUntil, adminBannedBy)
			if err != nil {
				log.Fatalf("failed to ban admin: %v", err)
			}
			if n == 0 {
				fmt.Println("no admin found for given email")
			} else {
				fmt.Printf("banned %d admin(s)\n", n)
			}
		},
	}

	adminBanCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminBanCmd.Flags().StringVar(&adminBanReason, "reason", "", "ban reason")
	adminBanCmd.Flags().StringVar(&adminBanUntil, "until", "", "ban until (RFC3339, optional for permanent ban)")
	adminBanCmd.Flags().StringVar(&adminBannedBy, "by", "", "admin id who performs the ban (optional)")
	adminBanCmd.MarkFlagRequired("email")

	adminUnbanCmd := &cobra.Command{
		Use:   "unban",
		Short: "Remove ban from an admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			n, err := unbanAdminByEmail(adminEmail)
			if err != nil {
				log.Fatalf("failed to unban admin: %v", err)
			}
			if n == 0 {
				fmt.Println("no admin found for given email")
			} else {
				fmt.Printf("unbanned %d admin(s)\n", n)
			}
		},
	}

	adminUnbanCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminUnbanCmd.MarkFlagRequired("email")

	// Superadmin management commands
	adminSuperCmd := &cobra.Command{Use: "super", Short: "Manage superadmin status"}

	adminSuperEnableCmd := &cobra.Command{
		Use:   "enable",
		Short: "Grant superadmin to an admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			if adminEmail == "" {
				log.Fatalf("email is required")
			}
			gdb, err := db.GetGormDB()
			if err != nil {
				log.Fatalf("failed to get db: %v", err)
			}
			svc := services.New(gdb)
			admin, err := svc.GetAdminByEmail(context.Background(), adminEmail)
			if err != nil {
				log.Fatalf("failed to find admin: %v", err)
			}
			if admin.IsSuperAdmin {
				fmt.Println("admin is already superadmin")
				return
			}
			if err := gdb.WithContext(context.Background()).Model(&authmodels.Admin{}).Where("id = ?", admin.ID).Updates(map[string]interface{}{"is_superadmin": true, "updated_at": time.Now()}).Error; err != nil {
				log.Fatalf("failed to update admin: %v", err)
			}
			if err := svc.SeedDefaultRBAC(context.Background()); err != nil {
				log.Fatalf("failed to seed rbac: %v", err)
			}
			var role authmodels.Role
			if err := gdb.WithContext(context.Background()).Where("name = ?", "superadmin").First(&role).Error; err != nil {
				log.Fatalf("failed to find superadmin role: %v", err)
			}
			if err := svc.AssignRole(context.Background(), role.ID, admin.ID, nil); err != nil {
				log.Fatalf("failed to assign role: %v", err)
			}
			fmt.Printf("superadmin enabled for %s\n", adminEmail)
		},
	}
	adminSuperEnableCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminSuperEnableCmd.MarkFlagRequired("email")

	adminSuperDisableCmd := &cobra.Command{
		Use:   "disable",
		Short: "Revoke superadmin from an admin by email",
		Run: func(cmd *cobra.Command, args []string) {
			if adminEmail == "" {
				log.Fatalf("email is required")
			}
			gdb, err := db.GetGormDB()
			if err != nil {
				log.Fatalf("failed to get db: %v", err)
			}
			svc := services.New(gdb)
			admin, err := svc.GetAdminByEmail(context.Background(), adminEmail)
			if err != nil {
				log.Fatalf("failed to find admin: %v", err)
			}
			if !admin.IsSuperAdmin {
				fmt.Println("admin is not a superadmin")
				return
			}
			var count int64
			if err := gdb.Model(&authmodels.Admin{}).Where("is_superadmin = ?", true).Count(&count).Error; err != nil {
				log.Fatalf("failed to count superadmins: %v", err)
			}
			if count <= 1 {
				log.Fatalf("cannot revoke the last remaining superadmin")
			}
			if err := gdb.WithContext(context.Background()).Model(&authmodels.Admin{}).Where("id = ?", admin.ID).Updates(map[string]interface{}{"is_superadmin": false, "updated_at": time.Now()}).Error; err != nil {
				log.Fatalf("failed to update admin: %v", err)
			}
			var role authmodels.Role
			if err := gdb.WithContext(context.Background()).Where("name = ?", "superadmin").First(&role).Error; err == nil {
				_ = svc.UnassignRole(context.Background(), role.ID, admin.ID, nil)
			}
			fmt.Printf("superadmin revoked for %s\n", adminEmail)
		},
	}
	adminSuperDisableCmd.Flags().StringVar(&adminEmail, "email", "", "admin email")
	adminSuperDisableCmd.MarkFlagRequired("email")

	adminSuperCmd.AddCommand(adminSuperEnableCmd, adminSuperDisableCmd)

	adminCmd.AddCommand(adminCreateCmd, adminGetCmd, adminDeleteCmd, adminPasswdCmd, adminRestoreCmd, adminActivateCmd, adminDeactivateCmd, adminBanCmd, adminUnbanCmd, adminSuperCmd)
	return []*cobra.Command{adminCmd}
}

func createAdmin(username, email, password string) error {
	id, err := uuid.New()
	if err != nil {
		return err
	}
	gdb, err := db.GetGormDB()
	if err != nil {
		return err
	}

	svc := services.New(gdb)

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	admin := &authmodels.Admin{
		ID:           id,
		Username:     username,
		Email:        email,
		PasswordHash: string(hashed),
	}
	// Activation flag precedence: --no-activate overrides --activate
	if adminNoActivate {
		admin.IsActivatedAt = nil
	} else if adminActivate {
		t := time.Now()
		admin.IsActivatedAt = &t
	}
	// Determine if this is the first admin (no existing admins)
	var count int64
	if err := gdb.Model(&authmodels.Admin{}).Count(&count).Error; err != nil {
		return err
	}
	isFirst := count == 0
	if isFirst {
		admin.IsSuperAdmin = true
	}

	if err := svc.CreateAdmin(context.Background(), admin); err != nil {
		return err
	}

	if isFirst {
		// Ensure RBAC seed exists and assign superadmin role
		if err := svc.SeedDefaultRBAC(context.Background()); err != nil {
			return err
		}
		var role authmodels.Role
		if err := gdb.WithContext(context.Background()).Where("name = ?", "superadmin").First(&role).Error; err != nil {
			return err
		}
		if err := svc.AssignRole(context.Background(), role.ID, admin.ID, nil); err != nil {
			return err
		}
	}

	return nil
}

func getAdminByEmail(email string) (*authmodels.Admin, error) {
	gdb, err := db.GetGormDB()
	if err != nil {
		return nil, err
	}
	svc := services.New(gdb)
	return svc.GetAdminByEmail(context.Background(), email)
}

func deleteAdminByEmail(email string) (int64, error) {
	gdb, err := db.GetGormDB()
	if err != nil {
		return 0, err
	}
	svc := services.New(gdb)
	return svc.DeleteAdminByEmail(context.Background(), email)
}

func updateAdminPassword(email, password string) error {
	gdb, err := db.GetGormDB()
	if err != nil {
		return err
	}
	svc := services.New(gdb)
	return svc.UpdatePasswordByEmail(context.Background(), email, password)
}

func restoreAdminByEmail(email string) (int64, error) {
	gdb, err := db.GetGormDB()
	if err != nil {
		return 0, err
	}
	svc := services.New(gdb)
	return svc.RestoreAdminByEmail(context.Background(), email)
}

func activateAdminByEmail(email string) (int64, error) {
	gdb, err := db.GetGormDB()
	if err != nil {
		return 0, err
	}
	svc := services.New(gdb)
	return svc.ActivateAdminByEmail(context.Background(), email)
}

func deactivateAdminByEmail(email string) (int64, error) {
	gdb, err := db.GetGormDB()
	if err != nil {
		return 0, err
	}
	svc := services.New(gdb)
	return svc.DeactivateAdminByEmail(context.Background(), email)
}

func banAdminByEmail(email, reason, until, bannedBy string) (int64, error) {
	gdb, err := db.GetGormDB()
	if err != nil {
		return 0, err
	}
	var untilPtr *time.Time
	if until != "" {
		t, err := time.Parse(time.RFC3339, until)
		if err != nil {
			return 0, fmt.Errorf("invalid --until format, expected RFC3339: %w", err)
		}
		untilPtr = &t
	}
	var bannedByPtr *string
	if bannedBy != "" {
		bannedByPtr = &bannedBy
	}
	svc := services.New(gdb)
	return svc.BanAdminByEmail(context.Background(), email, reason, untilPtr, bannedByPtr)
}

func unbanAdminByEmail(email string) (int64, error) {
	gdb, err := db.GetGormDB()
	if err != nil {
		return 0, err
	}
	svc := services.New(gdb)
	return svc.UnbanAdminByEmail(context.Background(), email)
}
