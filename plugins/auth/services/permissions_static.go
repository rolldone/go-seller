package services

import (
	"strings"

	"go_framework/plugins/auth/models"
)

// staticPermissions defines canonical permission keys, names, descriptions and grouping.
var staticPermissions = []struct {
	Key         string
	Name        string
	Description *string
	Group       string
}{
	{Key: "admins.view", Name: "View admin accounts", Description: strPtrStatic("View admin accounts"), Group: "Admin"},
	{Key: "admins.manage", Name: "Manage admin accounts", Description: strPtrStatic("Create/update/delete admin accounts"), Group: "Admin"},
	{Key: "users.view", Name: "View users", Description: strPtrStatic("View users"), Group: "Users"},
	{Key: "users.manage", Name: "Manage users", Description: strPtrStatic("Create/update/delete/ban users"), Group: "Users"},
	{Key: "customers.view", Name: "View customers", Description: strPtrStatic("View customers"), Group: "Customers"},
	{Key: "customers.manage", Name: "Manage customers", Description: strPtrStatic("Create/update/delete/ban customers"), Group: "Customers"},
	{Key: "products.view", Name: "View products", Description: strPtrStatic("View products"), Group: "Catalog"},
	{Key: "products.manage", Name: "Manage products", Description: strPtrStatic("Create/update/delete/publish products"), Group: "Catalog"},
	{Key: "businesses.view", Name: "View businesses", Description: strPtrStatic("View businesses"), Group: "Catalog"},
	{Key: "businesses.manage", Name: "Manage businesses", Description: strPtrStatic("Create/update/delete businesses"), Group: "Catalog"},
	{Key: "categories.view", Name: "View categories", Description: strPtrStatic("View categories"), Group: "Catalog"},
	{Key: "categories.manage", Name: "Manage categories", Description: strPtrStatic("Create/update/delete categories"), Group: "Catalog"},
	{Key: "tags.view", Name: "View tags", Description: strPtrStatic("View tags"), Group: "Catalog"},
	{Key: "tags.manage", Name: "Manage tags", Description: strPtrStatic("Create/update/delete tags"), Group: "Catalog"},
	{Key: "coupons.view", Name: "View coupons", Description: strPtrStatic("View coupons"), Group: "Marketing"},
	{Key: "coupons.manage", Name: "Manage coupons", Description: strPtrStatic("Create/update/delete coupons"), Group: "Marketing"},
	{Key: "discounts.view", Name: "View discounts", Description: strPtrStatic("View discounts"), Group: "Marketing"},
	{Key: "discounts.manage", Name: "Manage discounts", Description: strPtrStatic("Create/update/delete discounts"), Group: "Marketing"},
	{Key: "subscriptions.view", Name: "View subscribers", Description: strPtrStatic("View and export subscriber lists"), Group: "Marketing"},
	{Key: "subscriptions.manage", Name: "Manage subscribers", Description: strPtrStatic("Export, resend and delete subscribers"), Group: "Marketing"},
	{Key: "assets.view", Name: "View assets", Description: strPtrStatic("View assets"), Group: "Assets"},
	{Key: "assets.manage", Name: "Manage assets", Description: strPtrStatic("Upload/update/delete assets"), Group: "Assets"},
	{Key: "roles.view", Name: "View roles and permissions", Description: strPtrStatic("View roles and permissions"), Group: "Admin"},
	{Key: "roles.manage", Name: "Manage roles", Description: strPtrStatic("Manage role and permission assignments"), Group: "Admin"},
	{Key: "audit.view", Name: "View audit records", Description: strPtrStatic("View authorization audit records"), Group: "Admin"},
}

func strPtrStatic(s string) *string { return &s }

// ExposeStaticPermissions returns a slice compatible with authmodels.Permission for handlers.
func ExposeStaticPermissions() []models.Permission {
	out := make([]models.Permission, 0, len(staticPermissions))
	for _, p := range staticPermissions {
		out = append(out, models.Permission{Key: p.Key, Name: p.Name, Description: p.Description})
	}
	return out
}

// ExposeStaticPermissionsGrouped returns permissions grouped by explicit Group field.
// If Group is empty for an entry, falls back to prefix before the first '.'
func ExposeStaticPermissionsGrouped() map[string][]string {
	out := map[string][]string{}
	for _, p := range staticPermissions {
		group := p.Group
		if group == "" {
			parts := strings.SplitN(p.Key, ".", 2)
			if len(parts) > 0 {
				group = strings.Title(parts[0])
			} else {
				group = "General"
			}
		}
		out[group] = append(out[group], p.Key)
	}
	return out
}
