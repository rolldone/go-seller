package handlers

import (
	"errors"
	"io"
	"net/http"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DigitalFileHandler handles product digital file endpoints.
type DigitalFileHandler struct {
	svc *catalogservices.CatalogService
}

func NewDigitalFileHandler(svc *catalogservices.CatalogService) *DigitalFileHandler {
	return &DigitalFileHandler{svc: svc}
}

// List GET /admin/catalog/digital-files?product_id=...
func (h *DigitalFileHandler) List(c *gin.Context) {
	productID := c.Query("product_id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id is required"})
		return
	}
	files, err := h.svc.ListDigitalFiles(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": files})
}

// Upload POST /admin/catalog/digital-files/upload  (multipart)
func (h *DigitalFileHandler) Upload(c *gin.Context) {
	productID := c.PostForm("product_id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id is required"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	const maxSize = int64(200 * 1024 * 1024) // 200MB
	if fileHeader.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file exceeds 200MB limit"})
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open file"})
		return
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	downloadLimit := parseIntParam(c.PostForm("download_limit"), 0)
	sortOrder := parseIntParam(c.PostForm("sort_order"), 0)

	f, err := h.svc.UploadDigitalFile(
		c.Request.Context(),
		productID,
		fileHeader.Filename,
		fileHeader.Header.Get("Content-Type"),
		fileHeader.Size,
		data,
		downloadLimit,
		sortOrder,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, f)
}

type createDigitalFileReq struct {
	ProductID     string `json:"product_id" binding:"required"`
	FilePath      string `json:"file_path" binding:"required"`
	FileName      string `json:"file_name"`
	MimeType      string `json:"mime_type"`
	FileSize      int64  `json:"file_size"`
	DownloadLimit int    `json:"download_limit"`
	SortOrder     int    `json:"sort_order"`
}

// Create POST /admin/catalog/digital-files  (JSON, file already in storage)
func (h *DigitalFileHandler) Create(c *gin.Context) {
	var req createDigitalFileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	f := &catalogmodels.ProductDigitalFile{
		ID:            id,
		ProductID:     req.ProductID,
		FilePath:      req.FilePath,
		FileName:      req.FileName,
		MimeType:      req.MimeType,
		FileSize:      req.FileSize,
		DownloadLimit: req.DownloadLimit,
		SortOrder:     req.SortOrder,
		IsActive:      true,
	}
	if err := h.svc.CreateDigitalFile(c.Request.Context(), f); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, f)
}

// GetByID GET /admin/catalog/digital-files/:id
func (h *DigitalFileHandler) GetByID(c *gin.Context) {
	f, err := h.svc.GetDigitalFileByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, f)
}

// Update PATCH /admin/catalog/digital-files/:id
func (h *DigitalFileHandler) Update(c *gin.Context) {
	f, err := h.svc.GetDigitalFileByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if v, ok := payload["file_name"].(string); ok {
		f.FileName = v
	}
	if v, ok := payload["mime_type"].(string); ok {
		f.MimeType = v
	}
	if v, ok := payload["is_active"].(bool); ok {
		f.IsActive = v
	}
	if v, ok := payload["download_limit"].(float64); ok {
		f.DownloadLimit = int(v)
	}
	if v, ok := payload["sort_order"].(float64); ok {
		f.SortOrder = int(v)
	}
	if err := h.svc.UpdateDigitalFile(c.Request.Context(), f); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, f)
}

// Delete DELETE /admin/catalog/digital-files/:id
func (h *DigitalFileHandler) Delete(c *gin.Context) {
	if err := h.svc.DeleteDigitalFile(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// CustomerDownload GET /api/catalog/digital-files/:id/download
// Customer endpoint — requires paid order for this product.
func (h *DigitalFileHandler) CustomerDownload(c *gin.Context) {
	customerID, exists := c.Get("customer_id")
	if !exists || customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	f, err := h.svc.CanAccessDigitalFile(c.Request.Context(), c.Param("id"), customerID.(string))
	if err != nil {
		if err.Error() == "file not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		if err.Error() == "file is not available" || err.Error() == "access denied: no paid order found for this product" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Stream file from storage
	rc, err := h.svc.Store.Get(c.Request.Context(), f.FilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve file"})
		return
	}
	defer rc.Close()

	mimeType := f.MimeType
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	c.Header("Content-Disposition", "attachment; filename=\""+f.FileName+"\"")
	c.Header("Content-Type", mimeType)
	c.DataFromReader(http.StatusOK, f.FileSize, mimeType, rc, nil)
}
