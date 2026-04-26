package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	catalogservices "go_framework/plugins/catalog/services"
)

type BusinessAssetFolderHandler struct {
	svc *catalogservices.CatalogService
}

func NewBusinessAssetFolderHandler(svc *catalogservices.CatalogService) *BusinessAssetFolderHandler {
	return &BusinessAssetFolderHandler{svc: svc}
}

func (h *BusinessAssetFolderHandler) memberBusinessID(c *gin.Context) (string, bool) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return "", false
	}

	businessID := strings.TrimSpace(c.Param("business_id"))
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required in path"})
		return "", false
	}

	if _, err := h.svc.GetBusinessByIDForMember(c.Request.Context(), memberID, businessID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return "", false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return "", false
	}

	return businessID, true
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

func (h *BusinessAssetFolderHandler) MemberList(c *gin.Context) {
	businessID, ok := h.memberBusinessID(c)
	if !ok {
		return
	}
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

func (h *BusinessAssetFolderHandler) MemberCreate(c *gin.Context) {
	businessID, ok := h.memberBusinessID(c)
	if !ok {
		return
	}
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

func (h *BusinessAssetFolderHandler) MemberUpdate(c *gin.Context) {
	businessID, ok := h.memberBusinessID(c)
	if !ok {
		return
	}
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

func (h *BusinessAssetFolderHandler) MemberDelete(c *gin.Context) {
	businessID, ok := h.memberBusinessID(c)
	if !ok {
		return
	}
	folderID := c.Param("folder_id")
	if err := h.svc.DeleteBusinessAssetFolder(c.Request.Context(), businessID, folderID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "folder deleted"})
}
