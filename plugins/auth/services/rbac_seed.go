package services

import (
	"context"
	"fmt"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"

	"gorm.io/gorm"
)

type roleSeed struct {
	Name        string
	Description string
	IsSystem    bool
}

// SeedDefaultRBAC inserts default roles, permissions, and their mappings.
// This operation is idempotent and safe to run multiple times.
func (s *AuthService) SeedDefaultRBAC(ctx context.Context) error {
	roles := []roleSeed{
		{Name: "superadmin", Description: "Full access across all modules", IsSystem: true},
		{Name: "admin", Description: "Operational admin with broad management rights", IsSystem: true},
		{Name: "manager", Description: "Business manager with catalog and campaign rights", IsSystem: true},
		{Name: "editor", Description: "Content/catalog editor with no destructive access", IsSystem: true},
		{Name: "viewer", Description: "Read-only access", IsSystem: true},
	}

	// permissions are defined statically in code (see permissions_static.go)

	rolePermissionMap := map[string][]string{
		"superadmin": {
			"admins.view", "admins.manage", "users.view", "users.manage", "customers.view", "customers.manage",
			"products.view", "products.manage", "businesses.view", "businesses.manage",
			"categories.view", "categories.manage", "tags.view", "tags.manage",
			"coupons.view", "coupons.manage", "discounts.view", "discounts.manage",
			"assets.view", "assets.manage", "roles.view", "roles.manage", "audit.view",
		},
		"admin": {
			"admins.view", "users.view", "users.manage", "customers.view", "customers.manage",
			"products.view", "products.manage", "businesses.view", "businesses.manage",
			"categories.view", "categories.manage", "tags.view", "tags.manage",
			"coupons.view", "coupons.manage", "discounts.view", "discounts.manage",
			"assets.view", "assets.manage", "roles.view",
		},
		"manager": {
			"customers.view", "products.view", "products.manage", "businesses.view", "businesses.manage",
			"categories.view", "categories.manage", "tags.view", "tags.manage",
			"coupons.view", "coupons.manage", "discounts.view", "discounts.manage",
			"assets.view", "assets.manage",
		},
		"editor": {
			"products.view", "products.manage", "businesses.view", "businesses.manage",
			"categories.view", "categories.manage", "tags.view", "tags.manage",
			"assets.view", "assets.manage",
		},
		"viewer": {
			"users.view", "customers.view", "products.view", "businesses.view",
			"categories.view", "tags.view", "coupons.view", "discounts.view", "assets.view", "roles.view",
		},
	}

	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		roleIDByName := map[string]string{}
		for _, seed := range roles {
			id, err := ensureRole(tx, seed)
			if err != nil {
				return err
			}
			roleIDByName[seed.Name] = id
		}

		// Permissions are static (no permissions table).  Create role_permissions using permission keys.
		for roleName, permNames := range rolePermissionMap {
			roleID, ok := roleIDByName[roleName]
			if !ok {
				return fmt.Errorf("missing role %q while seeding role_permissions", roleName)
			}
			for _, permKey := range permNames {
				if err := ensureRolePermission(tx, roleID, permKey); err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func ensureRole(tx *gorm.DB, seed roleSeed) (string, error) {
	var row authmodels.Role
	err := tx.Where("name = ?", seed.Name).First(&row).Error
	if err == nil {
		if e := tx.Model(&authmodels.Role{}).Where("id = ?", row.ID).Updates(map[string]interface{}{
			"description": seed.Description,
			"is_system":   seed.IsSystem,
		}).Error; e != nil {
			return "", e
		}
		return row.ID, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return "", err
	}

	id, err := uuid.New()
	if err != nil {
		return "", err
	}
	row = authmodels.Role{
		ID:          id,
		Name:        seed.Name,
		Description: strPtr(seed.Description),
		IsSystem:    seed.IsSystem,
	}
	if err := tx.Create(&row).Error; err != nil {
		return "", err
	}
	return row.ID, nil
}

// permissions are static; no ensurePermission function is needed.

func ensureRolePermission(tx *gorm.DB, roleID, permissionID string) error {
	var row authmodels.RolePermission
	err := tx.Where("role_id = ? AND permission_key = ?", roleID, permissionID).First(&row).Error
	if err == nil {
		return nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	return tx.Create(&authmodels.RolePermission{RoleID: roleID, PermissionKey: permissionID}).Error
}

func strPtr(v string) *string {
	return &v
}
