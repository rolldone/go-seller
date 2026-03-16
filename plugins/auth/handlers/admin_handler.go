package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	"go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminHandler struct {
	svc *services.AuthService
}

func NewAdminHandler(svc *services.AuthService) *AdminHandler {
	return &AdminHandler{svc: svc}
}

type createAdminRequest struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	Activated *bool  `json:"activated"`
}

type updateAdminRequest struct {
	Username *string `json:"username"`
	Email    *string `json:"email"`
}

type changePasswordRequest struct {
	Password string `json:"password"`
}

func parseBoolQuery(v string) (*bool, error) {
	if strings.TrimSpace(v) == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (h *AdminHandler) Create(c *gin.Context) {
	var req createAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Username == "" || req.Email == "" || len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username, email required and password min 8 chars"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	admin := &authmodels.Admin{
		ID:           id,
		Username:     strings.TrimSpace(req.Username),
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		PasswordHash: string(hash),
	}
	if req.Activated == nil || *req.Activated {
		t := time.Now()
		admin.IsActivatedAt = &t
	}

	if err := h.svc.CreateAdmin(c.Request.Context(), admin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, admin)
}

func (h *AdminHandler) List(c *gin.Context) {
	isBanned, err := parseBoolQuery(c.Query("is_banned"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid is_banned"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page <= 0 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 {
		limit = 20
	}

	items, total, err := h.svc.ListAdmins(c.Request.Context(), services.ListAdminsFilter{
		Query:    c.Query("q"),
		IsBanned: isBanned,
		Page:     page,
		Limit:    limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// fetch assigned roles for the admins in the page
	adminIDs := make([]string, 0, len(items))
	for _, a := range items {
		adminIDs = append(adminIDs, a.ID)
	}
	rolesMap, err2 := h.svc.ListRolesForAdmins(c.Request.Context(), adminIDs)
	if err2 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	// build response items with roles
	type adminWithRoles struct {
		authmodels.Admin
		Roles []authmodels.Role `json:"roles"`
	}

	out := make([]adminWithRoles, 0, len(items))
	for _, a := range items {
		out = append(out, adminWithRoles{Admin: a, Roles: rolesMap[a.ID]})
	}

	c.JSON(http.StatusOK, gin.H{"data": out, "total": total, "page": page, "limit": limit})
}

func (h *AdminHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetAdminByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "admin not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *AdminHandler) Update(c *gin.Context) {
	var req updateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateAdminByID(c.Request.Context(), c.Param("id"), req.Username, req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.GetAdminByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *AdminHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteAdminByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "admin not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AdminHandler) Restore(c *gin.Context) {
	affected, err := h.svc.RestoreAdminByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "admin not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "admin restored"})
}

func (h *AdminHandler) ChangePassword(c *gin.Context) {
	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(strings.TrimSpace(req.Password)) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}

	if err := h.svc.UpdatePasswordByID(c.Request.Context(), c.Param("id"), req.Password); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "admin not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password updated"})
}
