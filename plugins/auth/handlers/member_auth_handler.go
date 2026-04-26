package handlers

import (
	"errors"
	"net/http"
	"strings"

	internalauth "go_framework/internal/auth"
	"go_framework/plugins/auth/services"
	pluginregistry "go_framework/plugins/plugin_registry"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type memberLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type memberVerifyEmailRequest struct {
	Token string `json:"token"`
}

type memberForgotPasswordRequest struct {
	Email    string `json:"email"`
	ResetURL string `json:"reset_url"`
}

type memberResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type memberAuthMeResponse struct {
	Authenticated bool `json:"authenticated"`
	Member        any  `json:"member"`
}

type MemberAuthHandler struct {
	svc *services.AuthService
}

func NewMemberAuthHandler(svc *services.AuthService) *MemberAuthHandler {
	return &MemberAuthHandler{svc: svc}
}

func (h *MemberAuthHandler) Login(c *gin.Context) {
	var req memberLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.AuthenticateUser(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "invalid") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "verified") || strings.Contains(strings.ToLower(err.Error()), "activated") {
			c.JSON(http.StatusForbidden, gin.H{"error": "email member belum diverifikasi"})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	accessToken, exp, err := h.svc.IssueMemberAccessToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"token_type":   "bearer",
		"expires_at":   exp,
		"member": gin.H{
			"id":              user.ID,
			"full_name":       user.FullName,
			"email":           user.Email,
			"phone_number":    user.PhoneNumber,
			"is_active":       user.IsActive,
			"is_activated_at": user.IsActivatedAt,
		},
	})
}

func (h *MemberAuthHandler) Me(c *gin.Context) {
	authz := strings.TrimSpace(c.GetHeader("Authorization"))
	if !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
		return
	}

	token := strings.TrimSpace(authz[len("Bearer "):])
	claims, err := internalauth.ParseAccessTokenClaims(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}
	if claims.Level != "member" {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient access level"})
		return
	}

	user, err := h.svc.GetUserByID(c.Request.Context(), claims.AdminID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !user.IsActive || user.IsBanned {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member account is inactive"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"authenticated": true,
			"member": gin.H{
				"id":              user.ID,
				"full_name":       user.FullName,
				"email":           user.Email,
				"phone_number":    user.PhoneNumber,
				"is_active":       user.IsActive,
				"is_activated_at": user.IsActivatedAt,
			},
		},
	})
}

func (h *MemberAuthHandler) VerifyEmail(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		var req memberVerifyEmailRequest
		if err := c.ShouldBindJSON(&req); err == nil {
			token = strings.TrimSpace(req.Token)
		}
	}
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	if err := h.svc.VerifyMemberEmailWithToken(c.Request.Context(), token); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "invalid") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired verification token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "email verified successfully"})
}

func (h *MemberAuthHandler) ForgotPassword(c *gin.Context) {
	var req memberForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusAccepted, gin.H{"message": "if account exists, reset instructions have been sent"})
		return
	}

	resetURL := strings.TrimSpace(req.ResetURL)
	if resetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reset_url is required"})
		return
	}

	token, exp, err := h.svc.GenerateMemberPasswordResetToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pluginregistry.SendTemplateEventAsync(c.Request.Context(), h.svc.DB, "member_forgot_password", map[string]interface{}{
		"member_name":   strings.TrimSpace(user.FullName),
		"member_email":  strings.TrimSpace(user.Email),
		"member_locale": "id",
		"reset_token":   token,
		"reset_url":     appendResetTokenQuery(resetURL, token),
		"app_name":      getAppName(),
	})

	resp := gin.H{"message": "if account exists, reset instructions have been sent"}
	if isResetTokenDebugEnabled() {
		resp["debug_reset_token"] = token
		resp["debug_reset_expires"] = exp
	}
	c.JSON(http.StatusAccepted, resp)
}

func (h *MemberAuthHandler) ResetPassword(c *gin.Context) {
	var req memberResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(strings.TrimSpace(req.Password)) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}

	if err := h.svc.ResetMemberPasswordWithToken(c.Request.Context(), req.Token, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password has been reset"})
}
