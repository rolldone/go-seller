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

type CustomerHandler struct {
	svc *services.AuthService
}

func NewCustomerHandler(svc *services.AuthService) *CustomerHandler {
	return &CustomerHandler{svc: svc}
}

type createCustomerRequest struct {
	Name     string  `json:"name"`
	Email    string  `json:"email"`
	Phone    string  `json:"phone"`
	Notes    *string `json:"notes"`
	IsActive *bool   `json:"is_active"`
}

type updateCustomerRequest struct {
	Name     *string `json:"name"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
	Notes    *string `json:"notes"`
	IsActive *bool   `json:"is_active"`
}

type banCustomerRequest struct {
	Reason      string  `json:"reason"`
	BannedUntil *string `json:"banned_until"`
}

func trimStringPtr(v *string) *string {
	if v == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*v)
	return &trimmed
}

func (h *CustomerHandler) Create(c *gin.Context) {
	var req createCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and email are required"})
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

	customer := &authmodels.Customer{
		ID:       id,
		Name:     strings.TrimSpace(req.Name),
		Email:    strings.ToLower(strings.TrimSpace(req.Email)),
		Phone:    strings.TrimSpace(req.Phone),
		Notes:    trimStringPtr(req.Notes),
		IsActive: isActive,
	}

	if err := h.svc.CreateCustomer(c.Request.Context(), customer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, customer)
}

func (h *CustomerHandler) List(c *gin.Context) {
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

	items, total, err := h.svc.ListCustomers(c.Request.Context(), services.ListCustomersFilter{
		Query:       strings.TrimSpace(c.Query("q")),
		Email:       strings.TrimSpace(c.Query("email")),
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

func (h *CustomerHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetCustomerByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *CustomerHandler) Update(c *gin.Context) {
	var req updateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateCustomerByID(
		c.Request.Context(),
		c.Param("id"),
		trimStringPtr(req.Name),
		trimStringPtr(req.Email),
		trimStringPtr(req.Phone),
		trimStringPtr(req.Notes),
		req.IsActive,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.GetCustomerByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *CustomerHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteCustomerByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *CustomerHandler) Restore(c *gin.Context) {
	affected, err := h.svc.RestoreCustomerByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "customer restored"})
}

func (h *CustomerHandler) Ban(c *gin.Context) {
	var req banCustomerRequest
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

	affected, err := h.svc.BanCustomerByID(c.Request.Context(), c.Param("id"), req.Reason, until, bannedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "customer banned"})
}

func (h *CustomerHandler) Unban(c *gin.Context) {
	affected, err := h.svc.UnbanCustomerByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "customer unbanned"})
}
