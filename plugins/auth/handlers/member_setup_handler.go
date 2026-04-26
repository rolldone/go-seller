package handlers

import (
	"net/http"
	"strings"

	"go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
)

type MemberSetupHandler struct {
	svc *services.AuthService
}

type memberSetupRequest struct {
	FullName     string `json:"full_name"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	PhoneNumber  string `json:"phone_number"`
	BusinessName string `json:"business_name"`
	BusinessSlug string `json:"business_slug"`
}

func NewMemberSetupHandler(svc *services.AuthService) *MemberSetupHandler {
	return &MemberSetupHandler{svc: svc}
}

func (h *MemberSetupHandler) Setup(c *gin.Context) {
	var req memberSetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	out, err := h.svc.SetupMemberWithBusiness(c.Request.Context(), services.MemberSetupInput{
		FullName:     req.FullName,
		Email:        req.Email,
		Password:     req.Password,
		PhoneNumber:  req.PhoneNumber,
		BusinessName: req.BusinessName,
		BusinessSlug: req.BusinessSlug,
	})
	if err != nil {
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		if strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "email or business slug already exists"})
			return
		}
		if strings.Contains(msg, "required") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": gin.H{
			"user":       out.User,
			"business":   out.Business,
			"membership": out.Membership,
		},
	})
}
