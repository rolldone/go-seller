package handlers

import (
	"errors"
	"net/http"
	"strings"

	"go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type MemberProfileHandler struct {
	svc *services.AuthService
}

func NewMemberProfileHandler(svc *services.AuthService) *MemberProfileHandler {
	return &MemberProfileHandler{svc: svc}
}

type updateProfileRequest struct {
	FullName    *string `json:"full_name"`
	PhoneNumber *string `json:"phone_number"`
}

type changeOwnPasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// GetProfile returns the current authenticated member's profile.
func (h *MemberProfileHandler) GetProfile(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	user, err := h.svc.GetUserByID(c.Request.Context(), memberID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "member not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"id":           user.ID,
			"full_name":    user.FullName,
			"email":        user.Email,
			"phone_number": user.PhoneNumber,
			"created_at":   user.CreatedAt,
		},
	})
}

// UpdateProfile updates the current member's full_name and phone_number.
func (h *MemberProfileHandler) UpdateProfile(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateUserByID(c.Request.Context(), memberID, req.FullName, nil, req.PhoneNumber, nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.GetUserByID(c.Request.Context(), memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"id":           user.ID,
			"full_name":    user.FullName,
			"email":        user.Email,
			"phone_number": user.PhoneNumber,
		},
	})
}

// ChangePassword validates the current password and sets a new one.
func (h *MemberProfileHandler) ChangePassword(c *gin.Context) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req changeOwnPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.CurrentPassword) == "" || strings.TrimSpace(req.NewPassword) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "current_password and new_password are required"})
		return
	}
	if len(req.NewPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "new_password must be at least 8 characters"})
		return
	}

	user, err := h.svc.GetUserByID(c.Request.Context(), memberID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "member not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if user.PasswordHash == nil || strings.TrimSpace(*user.PasswordHash) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot change password for this account"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "current password is incorrect"})
		return
	}

	if err := h.svc.UpdateUserPasswordByID(c.Request.Context(), memberID, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password updated successfully"})
}
