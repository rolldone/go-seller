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
	"gorm.io/gorm"
)

type UserHandler struct {
	svc *services.AuthService
}

func NewUserHandler(svc *services.AuthService) *UserHandler {
	return &UserHandler{svc: svc}
}

type createUserRequest struct {
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`
	IsActive    *bool  `json:"is_active"`
}

type updateUserRequest struct {
	FullName    *string `json:"full_name"`
	Email       *string `json:"email"`
	PhoneNumber *string `json:"phone_number"`
	IsActive    *bool   `json:"is_active"`
}

type banUserRequest struct {
	Reason      string  `json:"reason"`
	BannedUntil *string `json:"banned_until"`
}

func (h *UserHandler) Create(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.FullName) == "" || strings.TrimSpace(req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "full_name and email are required"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	user := &authmodels.User{
		ID:          id,
		FullName:    strings.TrimSpace(req.FullName),
		Email:       strings.ToLower(strings.TrimSpace(req.Email)),
		PhoneNumber: strings.TrimSpace(req.PhoneNumber),
		IsActive:    isActive,
	}

	if err := h.svc.CreateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *UserHandler) List(c *gin.Context) {
	isActive, err := parseBoolQuery(c.Query("is_active"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid is_active"})
		return
	}

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

	withDeleted := strings.ToLower(strings.TrimSpace(c.Query("with_deleted"))) == "true"

	items, total, err := h.svc.ListUsers(c.Request.Context(), services.ListUsersFilter{
		Query:       c.Query("q"),
		IsActive:    isActive,
		IsBanned:    isBanned,
		WithDeleted: withDeleted,
		Page:        page,
		Limit:       limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items, "total": total, "page": page, "limit": limit})
}

func (h *UserHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetUserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *UserHandler) Update(c *gin.Context) {
	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateUserByID(c.Request.Context(), c.Param("id"), req.FullName, req.Email, req.PhoneNumber, req.IsActive); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.GetUserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *UserHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteUserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *UserHandler) Restore(c *gin.Context) {
	affected, err := h.svc.RestoreUserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user restored"})
}

func (h *UserHandler) Ban(c *gin.Context) {
	var req banUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var until *time.Time
	if req.BannedUntil != nil && strings.TrimSpace(*req.BannedUntil) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.BannedUntil))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "banned_until must be RFC3339"})
			return
		}
		until = &parsed
	}

	adminID := strings.TrimSpace(c.GetString("admin_id"))
	var bannedBy *string
	if adminID != "" {
		bannedBy = &adminID
	}

	affected, err := h.svc.BanUserByID(c.Request.Context(), c.Param("id"), req.Reason, until, bannedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user banned"})
}

func (h *UserHandler) Unban(c *gin.Context) {
	affected, err := h.svc.UnbanUserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user unbanned"})
}
