package handlers

import (
	"errors"
	"net/http"
	"strings"

	"go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RBACHandler struct {
	svc *services.AuthService
}

func NewRBACHandler(svc *services.AuthService) *RBACHandler {
	return &RBACHandler{svc: svc}
}

type rolePayload struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Permissions []string `json:"permissions"`
}

type roleAssignPayload struct {
	AdminID         string  `json:"admin_id"`
	ScopeBusinessID *string `json:"scope_business_id"`
}

type roleResponse struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description *string  `json:"description,omitempty"`
	IsSystem    bool     `json:"is_system"`
	Permissions []string `json:"permissions"`
	CreatedAt   any      `json:"created_at,omitempty"`
	UpdatedAt   any      `json:"updated_at,omitempty"`
}

func (h *RBACHandler) ListRoles(c *gin.Context) {
	roles, err := h.svc.ListRoles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	out := make([]roleResponse, 0, len(roles))
	for _, role := range roles {
		perms, e := h.svc.GetRoleWithPermissions(c.Request.Context(), role.ID)
		if e != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": e.Error()})
			return
		}
		out = append(out, roleResponse{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description,
			IsSystem:    role.IsSystem,
			Permissions: perms.Permissions,
			CreatedAt:   role.CreatedAt,
			UpdatedAt:   role.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}

func (h *RBACHandler) GetRole(c *gin.Context) {
	row, err := h.svc.GetRoleWithPermissions(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, roleResponse{
		ID:          row.Role.ID,
		Name:        row.Role.Name,
		Description: row.Role.Description,
		IsSystem:    row.Role.IsSystem,
		Permissions: row.Permissions,
		CreatedAt:   row.Role.CreatedAt,
		UpdatedAt:   row.Role.UpdatedAt,
	})
}

func (h *RBACHandler) ListRoleAssignments(c *gin.Context) {
	roleID := strings.TrimSpace(c.Param("id"))
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role id required"})
		return
	}

	rows, err := h.svc.ListAssignmentsForRole(c.Request.Context(), roleID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// normalize response
	out := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		out = append(out, gin.H{
			"admin_id":          r.AdminID,
			"username":          r.Username,
			"email":             r.Email,
			"scope_business_id": r.ScopeBusinessID,
			"created_at":        r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}

func (h *RBACHandler) CreateRole(c *gin.Context) {
	var req rolePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	row, err := h.svc.CreateRoleWithPermissions(c.Request.Context(), req.Name, req.Description, req.Permissions)
	if err != nil {
		if errors.Is(err, services.ErrInvalidPermissions) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, roleResponse{
		ID:          row.Role.ID,
		Name:        row.Role.Name,
		Description: row.Role.Description,
		IsSystem:    row.Role.IsSystem,
		Permissions: row.Permissions,
		CreatedAt:   row.Role.CreatedAt,
		UpdatedAt:   row.Role.UpdatedAt,
	})
}

func (h *RBACHandler) UpdateRole(c *gin.Context) {
	var req rolePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	row, err := h.svc.UpdateRoleWithPermissions(c.Request.Context(), c.Param("id"), req.Name, req.Description, req.Permissions)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
			return
		}
		if errors.Is(err, services.ErrInvalidPermissions) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, roleResponse{
		ID:          row.Role.ID,
		Name:        row.Role.Name,
		Description: row.Role.Description,
		IsSystem:    row.Role.IsSystem,
		Permissions: row.Permissions,
		CreatedAt:   row.Role.CreatedAt,
		UpdatedAt:   row.Role.UpdatedAt,
	})
}

func (h *RBACHandler) DeleteRole(c *gin.Context) {
	err := h.svc.DeleteRole(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *RBACHandler) ListPermissions(c *gin.Context) {
	// Return grouped permissions by explicit group from static provider.
	grouped := services.ExposeStaticPermissionsGrouped()
	c.JSON(http.StatusOK, gin.H{"data": grouped})
}

func (h *RBACHandler) AssignRole(c *gin.Context) {
	roleID := strings.TrimSpace(c.Param("id"))
	var req roleAssignPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.AssignRole(c.Request.Context(), roleID, req.AdminID, req.ScopeBusinessID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role or admin not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *RBACHandler) UnassignRole(c *gin.Context) {
	roleID := strings.TrimSpace(c.Param("id"))
	var req roleAssignPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UnassignRole(c.Request.Context(), roleID, req.AdminID, req.ScopeBusinessID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
