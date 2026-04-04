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

type BusinessAssetHandler struct {
	svc *catalogservices.CatalogService
}

func NewBusinessAssetHandler(svc *catalogservices.CatalogService) *BusinessAssetHandler {
	return &BusinessAssetHandler{svc: svc}
}

type createBusinessAssetRequest struct {
	BusinessID   string `json:"business_id"`
	FilePath     string `json:"file_path"`
	FileType     string `json:"file_type"`
	IsMain       bool   `json:"is_main"`
	DisplayOrder int    `json:"display_order"`
	UsageTag     string `json:"usage_tag"`
}

func (h *BusinessAssetHandler) Create(c *gin.Context) {
	var req createBusinessAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.BusinessID == "" || req.FilePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id and file_path are required"})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	item := &catalogmodels.BusinessAsset{ID: id, BusinessID: req.BusinessID, FilePath: req.FilePath, FileType: req.FileType, IsMain: req.IsMain, DisplayOrder: req.DisplayOrder, UsageTag: req.UsageTag}
	if err := h.svc.CreateBusinessAsset(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *BusinessAssetHandler) List(c *gin.Context) {
	businessID := c.Param("business_id")
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 20)

	items, total, err := h.svc.ListBusinessAssets(c.Request.Context(), businessID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	base := strings.TrimRight(os.Getenv("APP_URL"), "/")
	for i := range items {
		if items[i].PublicURL != "" && strings.HasPrefix(items[i].PublicURL, "/") {
			items[i].PublicURL = base + items[i].PublicURL
			continue
		}
		if items[i].FilePath != "" {
			if full, err := h.svc.Store.PublicURL(c.Request.Context(), items[i].FilePath); err == nil {
				items[i].PublicURL = full
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *BusinessAssetHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetBusinessAssetByID(c.Request.Context(), c.Param("asset_id"))
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

func (h *BusinessAssetHandler) Update(c *gin.Context) {
	item, err := h.svc.GetBusinessAssetByID(c.Request.Context(), c.Param("asset_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
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

	if v, ok := payload["business_id"].(string); ok && v != "" {
		item.BusinessID = v
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
	if err := h.svc.UpdateBusinessAsset(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessAssetHandler) Delete(c *gin.Context) {
	if err := h.svc.DeleteBusinessAssetWithFile(c.Request.Context(), c.Param("asset_id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "asset deleted successfully"})
}

func (h *BusinessAssetHandler) Upload(c *gin.Context) {
	businessID := c.Param("business_id")
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required in path"})
		return
	}

	fileType := c.PostForm("file_type")
	isMain := c.PostForm("is_main") == "true"
	displayOrder := parseIntParam(c.PostForm("display_order"), 0)
	usageTag := c.PostForm("usage_tag")

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	maxSize := int64(10 * 1024 * 1024)
	if fileHeader.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size exceeds 10MB limit"})
		return
	}

	asset, err := h.svc.UploadBusinessAsset(c.Request.Context(), businessID, fileHeader, fileType, isMain, displayOrder, usageTag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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

type finalizeBusinessAssetRequest struct {
	IngestPath   string `json:"ingestPath" binding:"required"`
	MimeType     string `json:"mimeType"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	Size         int64  `json:"size"`
	OriginalName string `json:"originalName"`
	IsMain       bool   `json:"isMain"`
	DisplayOrder int    `json:"displayOrder"`
	UsageTag     string `json:"usageTag"`
}

// Finalize moves ingest file to public, validates and creates DB record
func (h *BusinessAssetHandler) Finalize(c *gin.Context) {
	businessID := c.Param("business_id")
	assetID := c.Param("asset_id")
	var req finalizeBusinessAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	asset, err := h.svc.FinalizeBusinessAsset(c.Request.Context(), businessID, assetID, req.IngestPath, req.MimeType, req.Width, req.Height, req.Size, req.OriginalName, req.IsMain, req.DisplayOrder, req.UsageTag)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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

	c.JSON(http.StatusOK, asset)
}

// RegisterDerivative accepts derivative metadata (called by background worker or client) and stores it.
func (h *BusinessAssetHandler) RegisterDerivative(c *gin.Context) {
	assetID := c.Param("asset_id")
	var payload struct {
		FilePath string `json:"file_path" binding:"required"`
		FileType string `json:"file_type"`
		MimeType string `json:"mime_type"`
		Width    int    `json:"width"`
		Height   int    `json:"height"`
		Size     int64  `json:"size"`
		Purpose  string `json:"purpose"`
		ID       string `json:"id"` // optional UUID if caller generated
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	id := payload.ID
	if id == "" {
		var err error
		id, err = uuid.New()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
			return
		}
	}
	d := &catalogmodels.BusinessAssetDerivative{
		ID:       id,
		AssetID:  assetID,
		FilePath: payload.FilePath,
		FileType: payload.FileType,
		MimeType: payload.MimeType,
		Width:    payload.Width,
		Height:   payload.Height,
		FileSize: payload.Size,
		Purpose:  payload.Purpose,
	}
	if err := h.svc.CreateBusinessAssetDerivative(c.Request.Context(), d); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *BusinessAssetHandler) ListDerivatives(c *gin.Context) {
	assetID := c.Param("asset_id")
	items, err := h.svc.ListBusinessAssetDerivatives(c.Request.Context(), assetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// PublicListDerivatives returns derivatives for an asset (public API).
// Supports optional `purpose` query to filter.
func (h *BusinessAssetHandler) PublicListDerivatives(c *gin.Context) {
	assetID := c.Param("asset_id")
	purpose := c.Query("purpose")

	items, err := h.svc.ListBusinessAssetDerivatives(c.Request.Context(), assetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var out []catalogmodels.BusinessAssetDerivative
	base := strings.TrimRight(os.Getenv("APP_URL"), "/")
	for _, it := range items {
		if purpose != "" && it.Purpose != purpose {
			continue
		}
		// resolve public URL if stored as relative path
		if it.FilePath != "" {
			if full, err := h.svc.Store.PublicURL(c.Request.Context(), it.FilePath); err == nil {
				it.FilePath = full
			} else if strings.HasPrefix(it.FilePath, "/") {
				it.FilePath = base + it.FilePath
			}
		}
		out = append(out, it)
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}

// PublicGetDerivative returns single derivative metadata by id (public API).
func (h *BusinessAssetHandler) PublicGetDerivative(c *gin.Context) {
	derivativeID := c.Param("derivative_id")
	assetID := c.Param("asset_id")

	items, err := h.svc.ListBusinessAssetDerivatives(c.Request.Context(), assetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var found *catalogmodels.BusinessAssetDerivative
	for _, it := range items {
		if it.ID == derivativeID {
			// copy to avoid mutating original
			tmp := it
			found = &tmp
			break
		}
	}
	if found == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "derivative not found"})
		return
	}

	if found.FilePath != "" {
		if full, err := h.svc.Store.PublicURL(c.Request.Context(), found.FilePath); err == nil {
			found.FilePath = full
		} else if strings.HasPrefix(found.FilePath, "/") {
			base := strings.TrimRight(os.Getenv("APP_URL"), "/")
			found.FilePath = base + found.FilePath
		}
	}

	c.JSON(http.StatusOK, found)
}
