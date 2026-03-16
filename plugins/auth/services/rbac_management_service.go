package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"

	"gorm.io/gorm"
)

// ErrInvalidPermissions indicates one or more provided permission keys are not recognized.
var ErrInvalidPermissions = errors.New("invalid permissions")

type RoleWithPermissions struct {
	Role        authmodels.Role
	Permissions []string
}

func (s *AuthService) GetRoleWithPermissions(ctx context.Context, roleID string) (*RoleWithPermissions, error) {
	roleID = strings.TrimSpace(roleID)
	if roleID == "" {
		return nil, gorm.ErrRecordNotFound
	}

	var role authmodels.Role
	if err := s.DB.WithContext(ctx).Where("id = ?", roleID).First(&role).Error; err != nil {
		return nil, err
	}

	names, err := s.rolePermissionNames(ctx, roleID)
	if err != nil {
		return nil, err
	}

	return &RoleWithPermissions{Role: role, Permissions: names}, nil
}

func (s *AuthService) CreateRoleWithPermissions(ctx context.Context, name string, description *string, permissions []string) (*RoleWithPermissions, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("role name is required")
	}

	// validate provided permission keys against static list
	normalized := uniqueTrimmed(permissions)
	if len(normalized) > 0 {
		allowed := map[string]struct{}{}
		for _, p := range staticPermissions {
			allowed[p.Key] = struct{}{}
		}
		invalid := make([]string, 0)
		for _, k := range normalized {
			if _, ok := allowed[k]; !ok {
				invalid = append(invalid, k)
			}
		}
		if len(invalid) > 0 {
			return nil, fmt.Errorf("%w: %s", ErrInvalidPermissions, strings.Join(invalid, ","))
		}
	}

	var result *RoleWithPermissions
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		id, err := uuid.New()
		if err != nil {
			return err
		}

		role := authmodels.Role{
			ID:          id,
			Name:        name,
			Description: normalizeNullableString(description),
			IsSystem:    false,
		}
		if err := tx.Create(&role).Error; err != nil {
			return err
		}

		names, err := s.replaceRolePermissionsTx(ctx, tx, role.ID, permissions)
		if err != nil {
			return err
		}

		result = &RoleWithPermissions{Role: role, Permissions: names}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *AuthService) UpdateRoleWithPermissions(ctx context.Context, roleID string, name string, description *string, permissions []string) (*RoleWithPermissions, error) {
	roleID = strings.TrimSpace(roleID)
	if roleID == "" {
		return nil, gorm.ErrRecordNotFound
	}

	// validate provided permission keys against static list
	normalized := uniqueTrimmed(permissions)
	if len(normalized) > 0 {
		allowed := map[string]struct{}{}
		for _, p := range staticPermissions {
			allowed[p.Key] = struct{}{}
		}
		invalid := make([]string, 0)
		for _, k := range normalized {
			if _, ok := allowed[k]; !ok {
				invalid = append(invalid, k)
			}
		}
		if len(invalid) > 0 {
			return nil, fmt.Errorf("%w: %s", ErrInvalidPermissions, strings.Join(invalid, ","))
		}
	}

	var result *RoleWithPermissions
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var role authmodels.Role
		if err := tx.Where("id = ?", roleID).First(&role).Error; err != nil {
			return err
		}

		updates := map[string]interface{}{}
		if strings.TrimSpace(name) != "" {
			updates["name"] = strings.TrimSpace(name)
		}
		updates["description"] = normalizeNullableString(description)

		if err := tx.Model(&authmodels.Role{}).Where("id = ?", roleID).Updates(updates).Error; err != nil {
			return err
		}

		if err := tx.Where("id = ?", roleID).First(&role).Error; err != nil {
			return err
		}

		names, err := s.replaceRolePermissionsTx(ctx, tx, roleID, permissions)
		if err != nil {
			return err
		}

		result = &RoleWithPermissions{Role: role, Permissions: names}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *AuthService) DeleteRole(ctx context.Context, roleID string) error {
	roleID = strings.TrimSpace(roleID)
	if roleID == "" {
		return gorm.ErrRecordNotFound
	}

	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var role authmodels.Role
		if err := tx.Where("id = ?", roleID).First(&role).Error; err != nil {
			return err
		}
		if role.IsSystem {
			return errors.New("cannot delete system role")
		}

		if err := tx.Where("role_id = ?", roleID).Delete(&authmodels.RolePermission{}).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", roleID).Delete(&authmodels.AdminRole{}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", roleID).Delete(&authmodels.Role{}).Error; err != nil {
			return err
		}

		return nil
	})
}

func (s *AuthService) AssignRole(ctx context.Context, roleID, adminID string, scopeBusinessID *string) error {
	roleID = strings.TrimSpace(roleID)
	adminID = strings.TrimSpace(adminID)
	if roleID == "" || adminID == "" {
		return errors.New("role_id and admin_id are required")
	}
	scopeBusinessID = normalizeNullableString(scopeBusinessID)

	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var role authmodels.Role
		if err := tx.Where("id = ?", roleID).First(&role).Error; err != nil {
			return err
		}

		var admin authmodels.Admin
		if err := tx.Where("id = ?", adminID).First(&admin).Error; err != nil {
			return err
		}

		q := tx.Where("admin_id = ? AND role_id = ?", adminID, roleID)
		if scopeBusinessID == nil {
			q = q.Where("scope_business_id IS NULL")
		} else {
			q = q.Where("scope_business_id = ?", *scopeBusinessID)
		}

		var row authmodels.AdminRole
		err := q.First(&row).Error
		if err == nil {
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}

		return tx.Create(&authmodels.AdminRole{
			AdminID:         adminID,
			RoleID:          roleID,
			ScopeBusinessID: scopeBusinessID,
		}).Error
	})
}

func (s *AuthService) UnassignRole(ctx context.Context, roleID, adminID string, scopeBusinessID *string) error {
	roleID = strings.TrimSpace(roleID)
	adminID = strings.TrimSpace(adminID)
	if roleID == "" || adminID == "" {
		return errors.New("role_id and admin_id are required")
	}
	scopeBusinessID = normalizeNullableString(scopeBusinessID)

	q := s.DB.WithContext(ctx).Where("admin_id = ? AND role_id = ?", adminID, roleID)
	if scopeBusinessID == nil {
		q = q.Where("scope_business_id IS NULL")
	} else {
		q = q.Where("scope_business_id = ?", *scopeBusinessID)
	}

	return q.Delete(&authmodels.AdminRole{}).Error
}

// ListAssignmentsForRole returns all assignments for a given role id.
func (s *AuthService) ListAssignmentsForRole(ctx context.Context, roleID string) ([]struct {
	AdminID         string
	Username        string
	Email           string
	ScopeBusinessID *string
	CreatedAt       time.Time
}, error) {
	roleID = strings.TrimSpace(roleID)
	if roleID == "" {
		return nil, gorm.ErrRecordNotFound
	}

	type outRow struct {
		AdminID         string    `gorm:"column:admin_id"`
		Username        string    `gorm:"column:username"`
		Email           string    `gorm:"column:email"`
		ScopeBusinessID *string   `gorm:"column:scope_business_id"`
		CreatedAt       time.Time `gorm:"column:created_at"`
	}

	var rows []outRow
	q := s.DB.WithContext(ctx).Table("admin_roles ar").Select("ar.admin_id, a.username, a.email, ar.scope_business_id, ar.created_at").Joins("join admins a on a.id = ar.admin_id").Where("ar.role_id = ?", roleID).Order("ar.created_at DESC")
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}

	out := make([]struct {
		AdminID         string
		Username        string
		Email           string
		ScopeBusinessID *string
		CreatedAt       time.Time
	}, 0, len(rows))

	for _, r := range rows {
		out = append(out, struct {
			AdminID         string
			Username        string
			Email           string
			ScopeBusinessID *string
			CreatedAt       time.Time
		}{
			AdminID:         r.AdminID,
			Username:        r.Username,
			Email:           r.Email,
			ScopeBusinessID: r.ScopeBusinessID,
			CreatedAt:       r.CreatedAt,
		})
	}

	return out, nil
}

func (s *AuthService) replaceRolePermissionsTx(ctx context.Context, tx *gorm.DB, roleID string, permissionNames []string) ([]string, error) {
	normalized := uniqueTrimmed(permissionNames)

	if err := tx.Where("role_id = ?", roleID).Delete(&authmodels.RolePermission{}).Error; err != nil {
		return nil, err
	}

	if len(normalized) == 0 {
		return []string{}, nil
	}

	// Validate against static permission keys and insert permission_key directly.
	allowed := map[string]struct{}{}
	for _, p := range staticPermissions {
		allowed[p.Key] = struct{}{}
	}

	rows := make([]authmodels.RolePermission, 0, len(normalized))
	selected := make([]string, 0, len(normalized))
	for _, name := range normalized {
		if _, ok := allowed[name]; !ok {
			continue
		}
		rows = append(rows, authmodels.RolePermission{RoleID: roleID, PermissionKey: name})
		selected = append(selected, name)
	}

	if len(rows) > 0 {
		if err := tx.Create(&rows).Error; err != nil {
			return nil, err
		}
	}

	return selected, nil
}

func (s *AuthService) rolePermissionNames(ctx context.Context, roleID string) ([]string, error) {
	var names []string
	err := s.DB.WithContext(ctx).
		Table("role_permissions rp").
		Distinct("rp.permission_key").
		Where("rp.role_id = ?", roleID).
		Order("rp.permission_key ASC").
		Pluck("rp.permission_key", &names).Error
	if err != nil {
		return nil, err
	}
	return names, nil
}

func normalizeNullableString(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func uniqueTrimmed(values []string) []string {
	set := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, v := range values {
		t := strings.TrimSpace(v)
		if t == "" {
			continue
		}
		if _, ok := set[t]; ok {
			continue
		}
		set[t] = struct{}{}
		out = append(out, t)
	}
	return out
}
