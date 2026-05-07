package handlers

import (
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const customerEmailVerificationExpiryMinutes = 24 * 60

type customerLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type customerRegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	Locale   string `json:"locale"`
}

type customerForgotPasswordRequest struct {
	Email    string `json:"email"`
	ResetURL string `json:"reset_url"`
}

type customerResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type customerVerifyEmailRequest struct {
	Token string `json:"token"`
}

func (h *CustomerHandler) Login(c *gin.Context) {
	var req customerLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	customer, err := h.svc.AuthenticateCustomer(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "invalid") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "verified") || strings.Contains(strings.ToLower(err.Error()), "activated") || strings.Contains(strings.ToLower(err.Error()), "not active") {
			c.JSON(http.StatusForbidden, gin.H{"error": "email customer belum diverifikasi"})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	accessToken, exp, err := h.svc.IssueCustomerAccessToken(customer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"token_type":   "bearer",
		"expires_at":   exp,
		"customer":     customer,
	})
}

func (h *CustomerHandler) Register(c *gin.Context) {
	var req customerRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Email) == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, email, and password are required"})
		return
	}

	locale, err := normalizeCustomerLocaleForRegister(req.Locale)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	verificationToken, _, err := h.svc.GenerateCustomerEmailVerificationToken(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	activationURL := buildCustomerVerificationURL(verificationToken, locale)

	customer := &authmodels.Customer{
		ID:       id,
		Name:     strings.TrimSpace(req.Name),
		Email:    strings.ToLower(strings.TrimSpace(req.Email)),
		Phone:    strings.TrimSpace(req.Phone),
		Locale:   locale,
		IsActive: false,
	}

	if err := h.svc.CreateCustomerWithPassword(c.Request.Context(), customer, req.Password); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pluginregistry.SendTemplateEventAsync(c.Request.Context(), h.svc.DB, "customer_setup_customer", map[string]interface{}{
		"customer_name":   strings.TrimSpace(customer.Name),
		"customer_email":  strings.TrimSpace(customer.Email),
		"customer_locale": strings.TrimSpace(customer.Locale),
		"activation_url":  activationURL,
		"ConfirmLink":     activationURL,
		"ExpiryMinutes":   customerEmailVerificationExpiryMinutes,
		"app_name":        getAppName(),
	})

	c.JSON(http.StatusCreated, gin.H{
		"message":               "Pendaftaran berhasil. Silakan cek email untuk verifikasi sebelum login.",
		"verification_required": true,
		"customer":              customer,
	})
}

func (h *CustomerHandler) VerifyEmail(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		var req customerVerifyEmailRequest
		if err := c.ShouldBindJSON(&req); err == nil {
			token = strings.TrimSpace(req.Token)
		}
	}
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	if err := h.svc.VerifyCustomerEmailWithToken(c.Request.Context(), token); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "invalid") || strings.Contains(strings.ToLower(err.Error()), "expired") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired verification token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "email verified successfully"})
}

func (h *CustomerHandler) ForgotPassword(c *gin.Context) {
	var req customerForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	customer, err := h.svc.GetCustomerByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusAccepted, gin.H{"message": "if account exists, reset instructions have been sent"})
		return
	}

	resetURL := strings.TrimSpace(req.ResetURL)
	if resetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reset_url is required"})
		return
	}

	token, exp, err := h.svc.GenerateCustomerPasswordResetToken(customer.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pluginregistry.SendTemplateEventAsync(c.Request.Context(), h.svc.DB, "customer_forgot_password", map[string]interface{}{
		"customer_name":   strings.TrimSpace(customer.Name),
		"customer_email":  strings.TrimSpace(customer.Email),
		"customer_locale": strings.TrimSpace(customer.Locale),
		"reset_token":     token,
		"reset_url":       appendResetTokenQuery(resetURL, token),
		"app_name":        getAppName(),
	})

	resp := gin.H{"message": "if account exists, reset instructions have been sent"}
	if isResetTokenDebugEnabled() {
		resp["debug_reset_token"] = token
		resp["debug_reset_expires"] = exp
	}
	c.JSON(http.StatusAccepted, resp)
}

func (h *CustomerHandler) ResetPassword(c *gin.Context) {
	var req customerResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(strings.TrimSpace(req.Password)) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}

	if err := h.svc.ResetCustomerPasswordWithToken(c.Request.Context(), req.Token, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password has been reset"})
}

func (h *CustomerHandler) Logout(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func (h *CustomerHandler) Me(c *gin.Context) {
	customerID := strings.TrimSpace(c.GetString("customer_id"))
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}

	customer, err := h.svc.GetCustomerByID(c.Request.Context(), customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !customer.IsActive || customer.IsBanned {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer account is inactive"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"authenticated": true,
			"customer":      customer,
		},
	})
}

func appendResetTokenQuery(resetURL string, token string) string {
	parsed, err := url.Parse(resetURL)
	if err != nil {
		return resetURL
	}
	query := parsed.Query()
	query.Set("token", token)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func normalizeCustomerLocaleForRegister(locale string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(locale))
	if value == "" {
		return "id", nil
	}
	switch value {
	case "id", "en":
		return value, nil
	default:
		return "", errors.New("locale must be one of: id, en")
	}
}

func getEnvOrDefault(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func buildCustomerVerificationURL(token, locale string) string {
	base := strings.TrimRight(strings.TrimSpace(getEnvOrDefault("FRONT_URL", "")), "/")
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(getEnvOrDefault("PUBLIC_APP_URL", "")), "/")
	}
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(getEnvOrDefault("APP_URL", "")), "/")
	}
	if base == "" {
		base = "http://localhost:4321"
	}

	path := "/customer/auth/verify"
	if strings.EqualFold(strings.TrimSpace(locale), "en") {
		path = "/en/customer/auth/verify"
	}

	return base + path + "?token=" + url.QueryEscape(token)
}

func getAppName() string {
	if name := strings.TrimSpace(os.Getenv("APP_NAME")); name != "" {
		return name
	}
	return "Go Seller"
}
