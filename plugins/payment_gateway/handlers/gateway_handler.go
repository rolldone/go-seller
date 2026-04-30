package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type GatewayHandler struct{}

type UpsertGatewayRequest struct {
	Name        string                 `json:"name" binding:"required"`
	ProviderKey string                 `json:"provider_key" binding:"required"`
	IsActive    bool                   `json:"is_active"`
	Credentials map[string]interface{} `json:"credentials,omitempty"`
	Config      map[string]interface{} `json:"config,omitempty"`
}

type ValidateGatewayRequest struct {
	ProviderKey string                 `json:"provider_key" binding:"required"`
	Credentials map[string]interface{} `json:"credentials"`
}

func NewGatewayHandler() *GatewayHandler {
	return &GatewayHandler{}
}

func (h *GatewayHandler) List(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}, "message": "payment gateway list not yet implemented"})
}

func (h *GatewayHandler) Create(c *gin.Context) {
	var req UpsertGatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload", "details": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": req, "message": "payment gateway creation endpoint scaffolded"})
}

func (h *GatewayHandler) Update(c *gin.Context) {
	var req UpsertGatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": req, "message": "payment gateway update endpoint scaffolded"})
}

func (h *GatewayHandler) Activate(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "payment gateway activate endpoint scaffolded"})
}

func (h *GatewayHandler) Deactivate(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "payment gateway deactivate endpoint scaffolded"})
}

func (h *GatewayHandler) Validate(c *gin.Context) {
	var req ValidateGatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"provider_key": req.ProviderKey, "message": "gateway credentials validation scaffolded"})
}
