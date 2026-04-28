package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
)

type businessTeamInviteRequest struct {
	Email string  `json:"email"`
	Role  *string `json:"role"`
}

type businessTeamStatusRequest struct {
	Status string  `json:"status"`
	Reason *string `json:"reason"`
}

type businessTeamRoleRequest struct {
	Role string `json:"role"`
}

type businessTeamInviteAcceptRequest struct {
	Token string `json:"token"`
}

type businessTeamInviteResolveResponse struct {
	Data *catalogservices.TeamInviteResolution `json:"data"`
}

type BusinessTeamHandler struct {
	svc *catalogservices.CatalogService
}

func NewBusinessTeamHandler(svc *catalogservices.CatalogService) *BusinessTeamHandler {
	return &BusinessTeamHandler{svc: svc}
}

func (h *BusinessTeamHandler) ListMembers(c *gin.Context) {
	businessID := c.Param("business_id")
	if !requireMemberBusinessOwnerAccess(c, h.svc, businessID) {
		return
	}

	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	page := parseQueryInt(c, "page", 1)
	limit := parseQueryInt(c, "limit", 20)
	status := strings.TrimSpace(c.Query("status"))

	rows, total, err := h.svc.ListBusinessMembers(c.Request.Context(), memberID, businessID, status, page, limit)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "invalid member status") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows, "total": total, "page": page, "limit": limit})
}

func (h *BusinessTeamHandler) InviteMember(c *gin.Context) {
	businessID := c.Param("business_id")
	if !requireMemberBusinessOwnerAccess(c, h.svc, businessID) {
		return
	}

	var req businessTeamInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	memberID, _ := memberIDFromContext(c)
	member, err := h.svc.InviteBusinessMember(c.Request.Context(), memberID, businessID, email, stringOrEmpty(req.Role))
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "record not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "member user not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": member, "message": "invite sent successfully"})
}

func (h *BusinessTeamHandler) ResolveInvite(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}
	data, err := h.svc.ResolveBusinessMemberInvite(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, businessTeamInviteResolveResponse{Data: data})
}

func (h *BusinessTeamHandler) AcceptInvite(c *gin.Context) {
	var req businessTeamInviteAcceptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	member, err := h.svc.AcceptBusinessMemberInvite(c.Request.Context(), token)
	if err != nil {
		if errors.Is(err, catalogservices.ErrBusinessTeamInviteSetupRequired) {
			c.JSON(http.StatusConflict, gin.H{"error": "member setup required"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "invalid") || strings.Contains(strings.ToLower(err.Error()), "expired") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired invite token"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invite accepted successfully", "data": member})
}

func (h *BusinessTeamHandler) UpdateMemberStatus(c *gin.Context) {
	businessID := c.Param("business_id")
	if !requireMemberBusinessOwnerAccess(c, h.svc, businessID) {
		return
	}

	var req businessTeamStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status is required"})
		return
	}

	memberID, _ := memberIDFromContext(c)
	member, err := h.svc.UpdateBusinessMemberStatus(c.Request.Context(), memberID, businessID, c.Param("member_id"), status, stringOrEmpty(req.Reason))
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "invalid member status") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": member})
}

func (h *BusinessTeamHandler) UpdateMemberRole(c *gin.Context) {
	businessID := c.Param("business_id")
	if !requireMemberBusinessOwnerAccess(c, h.svc, businessID) {
		return
	}

	var req businessTeamRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role is required"})
		return
	}

	memberID, _ := memberIDFromContext(c)
	member, err := h.svc.UpdateBusinessMemberRole(c.Request.Context(), memberID, businessID, c.Param("member_id"), role)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "invalid role") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": member})
}

func (h *BusinessTeamHandler) DeleteMember(c *gin.Context) {
	businessID := c.Param("business_id")
	if !requireMemberBusinessOwnerAccess(c, h.svc, businessID) {
		return
	}

	memberID, _ := memberIDFromContext(c)
	if err := h.svc.DeleteBusinessMember(c.Request.Context(), memberID, businessID, c.Param("member_id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed successfully"})
}

func parseQueryInt(c *gin.Context, key string, fallback int) int {
	value := strings.TrimSpace(c.Query(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
