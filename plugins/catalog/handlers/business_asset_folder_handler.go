package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	catalogservices "go_framework/plugins/catalog/services"
)

type BusinessAssetFolderHandler struct {
	svc *catalogservices.CatalogService
}

func NewBusinessAssetFolderHandler(svc *catalogservices.CatalogService) *BusinessAssetFolderHandler {
	return &BusinessAssetFolderHandler{svc: svc}
}

func (h *BusinessAssetFolderHandler) List(c *gin.Context) {
	businessID := c.Param("business_id")
	items, err := h.svc.ListBusinessAssetFolders(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BusinessAssetFolderHandler) Create(c *gin.Context) {
	businessID := c.Param("business_id")
	var req struct {
		Name     string  `json:"name" binding:"required"`
		ParentID *string `json:"parent_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ParentID != nil {
		v := strings.TrimSpace(*req.ParentID)
		if v == "" {
			req.ParentID = nil
		} else {
			req.ParentID = &v
		}
	}

	item, err := h.svc.CreateBusinessAssetFolder(c.Request.Context(), businessID, req.Name, req.ParentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *BusinessAssetFolderHandler) Update(c *gin.Context) {
	businessID := c.Param("business_id")
	folderID := c.Param("folder_id")
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.UpdateBusinessAssetFolder(c.Request.Context(), businessID, folderID, req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessAssetFolderHandler) Delete(c *gin.Context) {
	businessID := c.Param("business_id")
	folderID := c.Param("folder_id")
	if err := h.svc.DeleteBusinessAssetFolder(c.Request.Context(), businessID, folderID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "folder deleted"})
}
