package handlers

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProductAssetHandler struct {
	svc *catalogservices.CatalogService
}

func NewProductAssetHandler(svc *catalogservices.CatalogService) *ProductAssetHandler {
	return &ProductAssetHandler{svc: svc}
}

type createProductAssetRequest struct {
	ProductID    string `json:"product_id"`
	FilePath     string `json:"file_path"`
	FileType     string `json:"file_type"`
	IsMain       bool   `json:"is_main"`
	DisplayOrder int    `json:"display_order"`
	UsageTag     string `json:"usage_tag"`
}

func (h *ProductAssetHandler) Create(c *gin.Context) {
	var req createProductAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ProductID == "" || req.FilePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id and file_path are required"})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	item := &catalogmodels.ProductAsset{ID: id, ProductID: req.ProductID, FilePath: req.FilePath, FileType: req.FileType, IsMain: req.IsMain, DisplayOrder: req.DisplayOrder, UsageTag: req.UsageTag}
	if err := h.svc.CreateProductAsset(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *ProductAssetHandler) List(c *gin.Context) {
	productID := c.Query("product_id")
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 20)

	items, total, err := h.svc.ListProductAssets(c.Request.Context(), productID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Compose full public URLs for each item. Prefer APP_URL + stored path when stored
	// public_url is a relative path (e.g. "/assets/...") to keep DB domain-independent.
	base := strings.TrimRight(os.Getenv("APP_URL"), "/")
	for i := range items {
		if items[i].PublicURL != "" && strings.HasPrefix(items[i].PublicURL, "/") {
			items[i].PublicURL = base + items[i].PublicURL
			continue
		}
		// fallback to storage driver if value is not a path
		if items[i].FilePath != "" {
			if full, err := h.svc.Store.PublicURL(c.Request.Context(), items[i].FilePath); err == nil {
				items[i].PublicURL = full
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *ProductAssetHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetProductAssetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if item != nil {
		if item.PublicURL != "" && strings.HasPrefix(item.PublicURL, "/") {
			base := strings.TrimRight(os.Getenv("APP_URL"), "/")
			item.PublicURL = base + item.PublicURL
		} else if item.FilePath != "" {
			if full, err := h.svc.Store.PublicURL(c.Request.Context(), item.FilePath); err == nil {
				item.PublicURL = full
			}
		}
	}
	c.JSON(http.StatusOK, item)
}

func (h *ProductAssetHandler) Update(c *gin.Context) {
	item, err := h.svc.GetProductAssetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Bind to a generic map so we can detect which fields were provided
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if v, ok := payload["product_id"].(string); ok && v != "" {
		item.ProductID = v
	}
	if v, ok := payload["file_path"].(string); ok && v != "" {
		item.FilePath = v
	}
	if v, ok := payload["file_type"].(string); ok && v != "" {
		item.FileType = v
	}
	if v, exists := payload["usage_tag"]; exists {
		if v == nil {
			item.UsageTag = ""
		} else if s, ok := v.(string); ok {
			item.UsageTag = s
		}
	}
	if v, exists := payload["is_main"]; exists {
		if b, ok := v.(bool); ok {
			item.IsMain = b
		} else if n, ok := v.(float64); ok {
			item.IsMain = n != 0
		}
	}
	if v, exists := payload["display_order"]; exists {
		switch t := v.(type) {
		case float64:
			item.DisplayOrder = int(t)
		case int:
			item.DisplayOrder = t
		}
	}
	if err := h.svc.UpdateProductAsset(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *ProductAssetHandler) Delete(c *gin.Context) {
	// Use DeleteProductAssetWithFile untuk hapus file dan metadata
	if err := h.svc.DeleteProductAssetWithFile(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "asset deleted successfully"})
}

// Upload handles multipart file upload
func (h *ProductAssetHandler) Upload(c *gin.Context) {
	productID := c.PostForm("product_id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id is required"})
		return
	}

	fileType := c.PostForm("file_type")       // optional: image/video/doc
	isMain := c.PostForm("is_main") == "true" // optional
	displayOrder := parseIntParam(c.PostForm("display_order"), 0)
	usageTag := c.PostForm("usage_tag") // optional: thumbnail, social_4_5, etc.

	// Get uploaded file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	// Validate file size (maksimal 10MB)
	maxSize := int64(10 * 1024 * 1024) // 10MB
	if fileHeader.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size exceeds 10MB limit"})
		return
	}

	// Upload file
	asset, err := h.svc.UploadProductAsset(c.Request.Context(), productID, fileHeader, fileType, isMain, displayOrder, usageTag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Compose full public URL for response
	if asset != nil {
		if asset.PublicURL != "" && strings.HasPrefix(asset.PublicURL, "/") {
			base := strings.TrimRight(os.Getenv("APP_URL"), "/")
			asset.PublicURL = base + asset.PublicURL
		} else if asset.FilePath != "" {
			if full, err := h.svc.Store.PublicURL(c.Request.Context(), asset.FilePath); err == nil {
				asset.PublicURL = full
			}
		}
	}

	c.JSON(http.StatusCreated, asset)
}
