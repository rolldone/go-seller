package handlers

import (
	"errors"
	"net/http"
	"strings"

	marketingmodels "go_framework/plugins/marketing/models"
	marketingservices "go_framework/plugins/marketing/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BusinessCarouselHandler struct {
	svc *marketingservices.Service
}

func NewBusinessCarouselHandler(svc *marketingservices.Service) *BusinessCarouselHandler {
	return &BusinessCarouselHandler{svc: svc}
}

type upsertBusinessCarouselRequest struct {
	BusinessID string                                 `json:"businessId"`
	Slot       string                                 `json:"slot"`
	Title      string                                 `json:"title"`
	Subtitle   string                                 `json:"subtitle"`
	LayoutType string                                 `json:"layoutType"`
	IsActive   *bool                                  `json:"isActive"`
	SortOrder  *int                                   `json:"sortOrder"`
	Items      []marketingmodels.BusinessCarouselItem `json:"items"`
}

func (h *BusinessCarouselHandler) List(c *gin.Context) {
	businessID := strings.TrimSpace(c.Query("business_id"))
	items, err := h.svc.ListBusinessCarousels(c.Request.Context(), businessID, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BusinessCarouselHandler) PublicList(c *gin.Context) {
	businessID := strings.TrimSpace(c.Query("business_id"))
	if businessID == "" {
		c.JSON(http.StatusOK, gin.H{"data": []marketingmodels.BusinessCarousel{}})
		return
	}

	items, err := h.svc.ListBusinessCarousels(c.Request.Context(), businessID, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BusinessCarouselHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetBusinessCarouselByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "carousel not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *BusinessCarouselHandler) Create(c *gin.Context) {
	var req upsertBusinessCarouselRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	item, err := h.svc.CreateBusinessCarousel(
		c.Request.Context(),
		req.BusinessID,
		req.Slot,
		req.Title,
		req.Subtitle,
		req.LayoutType,
		isActive,
		sortOrder,
		req.Items,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h *BusinessCarouselHandler) Update(c *gin.Context) {
	var req upsertBusinessCarouselRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	item, err := h.svc.UpdateBusinessCarousel(
		c.Request.Context(),
		strings.TrimSpace(c.Param("id")),
		req.BusinessID,
		req.Slot,
		req.Title,
		req.Subtitle,
		req.LayoutType,
		isActive,
		sortOrder,
		req.Items,
	)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "carousel not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *BusinessCarouselHandler) Delete(c *gin.Context) {
	rows, err := h.svc.DeleteBusinessCarouselByID(c.Request.Context(), strings.TrimSpace(c.Param("id")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "carousel not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": rows})
}
