package services

import (
	"context"
	"strings"

	authmodels "go_framework/plugins/auth/models"
)

// ListRoles returns all roles ordered by name.
func (s *AuthService) ListRoles(ctx context.Context) ([]authmodels.Role, error) {
	var rows []authmodels.Role
	err := s.DB.WithContext(ctx).Order("name ASC").Find(&rows).Error
	return rows, err
}

// ListPermissions returns all permissions ordered by name.
func (s *AuthService) ListPermissions(ctx context.Context) ([]authmodels.Permission, error) {
	// Return static permissions defined in code.
	// use ExposeStaticPermissions to build a slice of models.Permission
	perms := ExposeStaticPermissions()
	// convert to authmodels.Permission (alias) if necessary
	rows := make([]authmodels.Permission, 0, len(perms))
	for _, p := range perms {
		rows = append(rows, authmodels.Permission{Key: p.Key, Name: p.Name, Description: p.Description})
	}
	return rows, nil
}

// AdminPermissionNames returns effective permission names for an admin.
func (s *AuthService) AdminPermissionNames(ctx context.Context, adminID string, scopeBusinessID *string) ([]string, error) {
	adminID = strings.TrimSpace(adminID)
	if adminID == "" {
		return []string{}, nil
	}

	var admin authmodels.Admin
	if err := s.DB.WithContext(ctx).Where("id = ?", adminID).First(&admin).Error; err != nil {
		return nil, err
	}
	if admin.IsSuperAdmin {
		return []string{"*"}, nil
	}

	q := s.DB.WithContext(ctx).
		Table("role_permissions rp").
		Distinct("rp.permission_key").
		Joins("JOIN admin_roles ar ON ar.role_id = rp.role_id").
		Where("ar.admin_id = ?", adminID)

	if scopeBusinessID != nil {
		scope := strings.TrimSpace(*scopeBusinessID)
		if scope != "" {
			q = q.Where("(ar.scope_business_id IS NULL OR ar.scope_business_id = ?)", scope)
		}
	}

	var names []string
	if err := q.Pluck("rp.permission_key", &names).Error; err != nil {
		return nil, err
	}
	return names, nil
}

// HasPermission checks whether an admin can perform a permission.
func (s *AuthService) HasPermission(ctx context.Context, adminID, permission string, scopeBusinessID *string) (bool, error) {
	permission = strings.TrimSpace(permission)
	if permission == "" {
		return false, nil
	}

	names, err := s.AdminPermissionNames(ctx, adminID, scopeBusinessID)
	if err != nil {
		return false, err
	}
	for _, name := range names {
		if name == "*" || name == permission {
			return true, nil
		}
	}
	return false, nil
}
