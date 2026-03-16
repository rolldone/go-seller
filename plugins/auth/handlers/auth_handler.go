package handlers

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func isResetTokenDebugEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_DEBUG_RESET_TOKEN")))
	return v == "1" || v == "true" || v == "yes"
}

type AuthHandler struct {
	svc *services.AuthService
}

func NewAuthHandler(svc *services.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	admin, err := h.svc.AuthenticateAdmin(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "invalid") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	accessToken, exp, err := h.svc.IssueAccessToken(admin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"token_type":   "bearer",
		"expires_at":   exp,
		"admin": gin.H{
			"id":              admin.ID,
			"username":        admin.Username,
			"email":           admin.Email,
			"is_activated_at": admin.IsActivatedAt,
			"is_banned":       admin.IsBanned,
		},
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// Stateless JWT logout on access token side.
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req forgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	admin, err := h.svc.GetAdminByEmail(c.Request.Context(), req.Email)
	if err != nil {
		// Prevent account enumeration.
		c.JSON(http.StatusAccepted, gin.H{"message": "if account exists, reset instructions have been sent"})
		return
	}

	token, exp, err := h.svc.GeneratePasswordResetToken(admin.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp := gin.H{"message": "if account exists, reset instructions have been sent"}
	if isResetTokenDebugEnabled() {
		resp["debug_reset_token"] = token
		resp["debug_reset_expires"] = exp
	}
	c.JSON(http.StatusAccepted, resp)
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req resetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(strings.TrimSpace(req.Password)) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}

	if err := h.svc.ResetPasswordWithToken(c.Request.Context(), req.Token, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password has been reset"})
}
