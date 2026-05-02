package handlers

import (
	"errors"
	"net/http"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// VariationHandler handles HTTP operations for product variations and attributes.
type VariationHandler struct {
	svc *catalogservices.CatalogService
}

// NewVariationHandler creates a VariationHandler.
func NewVariationHandler(svc *catalogservices.CatalogService) *VariationHandler {
	return &VariationHandler{svc: svc}
}

// =============================================================================
// AttributeGroup Requests & Responses
// =============================================================================

type createAttributeGroupRequest struct {
	Name         string  `json:"name" binding:"required"`
	Slug         string  `json:"slug"`
	Description  *string `json:"description"`
	DisplayOrder int     `json:"display_order"`
	IsActive     bool    `json:"is_active"`
	BusinessID   *string `json:"business_id"`
}

type updateAttributeGroupRequest struct {
	Name         *string `json:"name"`
	Slug         *string `json:"slug"`
	Description  *string `json:"description"`
	DisplayOrder *int    `json:"display_order"`
	IsActive     *bool   `json:"is_active"`
}

// =============================================================================
// Attribute Requests & Responses
// =============================================================================

type createAttributeRequest struct {
	AttributeGroupID string  `json:"attribute_group_id" binding:"required"`
	Name             string  `json:"name" binding:"required"`
	Slug             string  `json:"slug"`
	Description      *string `json:"description"`
	DisplayOrder     int     `json:"display_order"`
	IsActive         bool    `json:"is_active"`
}

type updateAttributeRequest struct {
	Name         *string `json:"name"`
	Slug         *string `json:"slug"`
	Description  *string `json:"description"`
	DisplayOrder *int    `json:"display_order"`
	IsActive     *bool   `json:"is_active"`
}

// =============================================================================
// ProductVariation Requests & Responses
// =============================================================================

type createProductVariationRequest struct {
	ProductID        string   `json:"product_id" binding:"required"`
	SKU              string   `json:"sku" binding:"required"`
	Price            float64  `json:"price" binding:"required"`
	ComparePrice     *float64 `json:"compare_price"`
	Weight           *float64 `json:"weight"`
	DimensionsLength *float64 `json:"dimensions_length"`
	DimensionsWidth  *float64 `json:"dimensions_width"`
	DimensionsHeight *float64 `json:"dimensions_height"`
	IsDefault        bool     `json:"is_default"`
	IsActive         bool     `json:"is_active"`
	AttributeIDs     []string `json:"attribute_ids"`
}

type updateProductVariationRequest struct {
	SKU              *string   `json:"sku"`
	Price            *float64  `json:"price"`
	ComparePrice     *float64  `json:"compare_price"`
	Weight           *float64  `json:"weight"`
	DimensionsLength *float64  `json:"dimensions_length"`
	DimensionsWidth  *float64  `json:"dimensions_width"`
	DimensionsHeight *float64  `json:"dimensions_height"`
	IsDefault        *bool     `json:"is_default"`
	IsActive         *bool     `json:"is_active"`
	AttributeIDs     *[]string `json:"attribute_ids"`
}

type updateVariationAssetsRequest struct {
	AssetIDs []string `json:"asset_ids"`
}

type variationResponse struct {
	catalogmodels.ProductVariation
	Attributes []attributeResponse `json:"attributes,omitempty"`
}

type attributeResponse struct {
	catalogmodels.Attribute
	Group *catalogmodels.AttributeGroup `json:"group,omitempty"`
}

// =============================================================================
// AttributeGroup Handlers
// =============================================================================

// CreateAttributeGroup creates a new attribute group.
func (h *VariationHandler) CreateAttributeGroup(c *gin.Context) {
	var req createAttributeGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	ag := &catalogmodels.AttributeGroup{
		ID:           id,
		Name:         strings.TrimSpace(req.Name),
		Slug:         strings.TrimSpace(req.Slug),
		Description:  req.Description,
		DisplayOrder: req.DisplayOrder,
		IsActive:     req.IsActive,
		BusinessID:   req.BusinessID,
	}

	if err := h.svc.CreateAttributeGroup(c.Request.Context(), ag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ag)
}

// GetAttributeGroup retrieves an attribute group by ID.
func (h *VariationHandler) GetAttributeGroup(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	ag, err := h.svc.GetAttributeGroupByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ag)
}

// ListAttributeGroups lists all attribute groups.
func (h *VariationHandler) ListAttributeGroups(c *gin.Context) {
	includeInactive := c.Query("include_inactive") == "true"
	businessID := strings.TrimSpace(c.Query("business_id"))

	groups, err := h.svc.ListAttributeGroups(c.Request.Context(), includeInactive, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// UpdateAttributeGroup updates an attribute group.
func (h *VariationHandler) UpdateAttributeGroup(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateAttributeGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ag, err := h.svc.GetAttributeGroupByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Apply partial updates
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		ag.Name = strings.TrimSpace(*req.Name)
	}
	if req.Slug != nil {
		ag.Slug = strings.TrimSpace(*req.Slug)
	}
	if req.Description != nil {
		ag.Description = req.Description
	}
	if req.DisplayOrder != nil {
		ag.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		ag.IsActive = *req.IsActive
	}

	if err := h.svc.UpdateAttributeGroup(c.Request.Context(), ag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ag)
}

// DeleteAttributeGroup soft-deletes an attribute group.
func (h *VariationHandler) DeleteAttributeGroup(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	if err := h.svc.DeleteAttributeGroup(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// =============================================================================
// Attribute Handlers
// =============================================================================

// CreateAttribute creates a new attribute.
func (h *VariationHandler) CreateAttribute(c *gin.Context) {
	var req createAttributeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	attr := &catalogmodels.Attribute{
		ID:               id,
		AttributeGroupID: req.AttributeGroupID,
		Name:             strings.TrimSpace(req.Name),
		Slug:             strings.TrimSpace(req.Slug),
		Description:      req.Description,
		DisplayOrder:     req.DisplayOrder,
		IsActive:         req.IsActive,
	}

	if err := h.svc.CreateAttribute(c.Request.Context(), attr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, attr)
}

// GetAttribute retrieves an attribute by ID.
func (h *VariationHandler) GetAttribute(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	attr, err := h.svc.GetAttributeByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attr)
}

// =============================================================================
// Member AttributeGroup Handlers
// =============================================================================

func (h *VariationHandler) MemberCreateAttributeGroup(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	var req createAttributeGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.BusinessID == nil || strings.TrimSpace(*req.BusinessID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	ag := &catalogmodels.AttributeGroup{
		ID:           id,
		Name:         strings.TrimSpace(req.Name),
		Slug:         strings.TrimSpace(req.Slug),
		Description:  req.Description,
		DisplayOrder: req.DisplayOrder,
		IsActive:     req.IsActive,
		BusinessID:   req.BusinessID,
	}

	if err := h.svc.CreateAttributeGroupForMember(c.Request.Context(), memberID, ag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ag)
}

func (h *VariationHandler) MemberListAttributeGroups(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	includeInactive := c.Query("include_inactive") == "true"
	businessID := strings.TrimSpace(c.Query("business_id"))

	groups, err := h.svc.ListAttributeGroupsForMember(c.Request.Context(), memberID, businessID, includeInactive)
	if err != nil {
		if strings.Contains(err.Error(), "required") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, groups)
}

func (h *VariationHandler) MemberGetAttributeGroup(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	ag, err := h.svc.GetAttributeGroupByIDForMember(c.Request.Context(), memberID, c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ag)
}

func (h *VariationHandler) MemberUpdateAttributeGroup(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateAttributeGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ag, err := h.svc.GetAttributeGroupByIDForMember(c.Request.Context(), memberID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		ag.Name = strings.TrimSpace(*req.Name)
	}
	if req.Slug != nil {
		ag.Slug = strings.TrimSpace(*req.Slug)
	}
	if req.Description != nil {
		ag.Description = req.Description
	}
	if req.DisplayOrder != nil {
		ag.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		ag.IsActive = *req.IsActive
	}

	if err := h.svc.UpdateAttributeGroupForMember(c.Request.Context(), memberID, ag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ag)
}

func (h *VariationHandler) MemberDeleteAttributeGroup(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	if err := h.svc.DeleteAttributeGroupForMember(c.Request.Context(), memberID, c.Param("id")); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// =============================================================================
// Member Attribute Handlers
// =============================================================================

func (h *VariationHandler) MemberCreateAttribute(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	var req createAttributeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	attr := &catalogmodels.Attribute{
		ID:               id,
		AttributeGroupID: req.AttributeGroupID,
		Name:             strings.TrimSpace(req.Name),
		Slug:             strings.TrimSpace(req.Slug),
		Description:      req.Description,
		DisplayOrder:     req.DisplayOrder,
		IsActive:         req.IsActive,
	}

	if err := h.svc.CreateAttributeForMember(c.Request.Context(), memberID, attr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, attr)
}

func (h *VariationHandler) MemberGetAttribute(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	attr, err := h.svc.GetAttributeByIDForMember(c.Request.Context(), memberID, c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attr)
}

func (h *VariationHandler) MemberListAttributesByGroup(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	includeInactive := c.Query("include_inactive") == "true"
	groupID := c.Param("id")
	attrs, err := h.svc.ListAttributesByGroupIDForMember(c.Request.Context(), memberID, groupID, includeInactive)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attrs)
}

func (h *VariationHandler) MemberUpdateAttribute(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateAttributeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	attr, err := h.svc.GetAttributeByIDForMember(c.Request.Context(), memberID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		attr.Name = strings.TrimSpace(*req.Name)
	}
	if req.Slug != nil {
		attr.Slug = strings.TrimSpace(*req.Slug)
	}
	if req.Description != nil {
		attr.Description = req.Description
	}
	if req.DisplayOrder != nil {
		attr.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		attr.IsActive = *req.IsActive
	}

	if err := h.svc.UpdateAttributeForMember(c.Request.Context(), memberID, attr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attr)
}

func (h *VariationHandler) MemberDeleteAttribute(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	if err := h.svc.DeleteAttributeForMember(c.Request.Context(), memberID, c.Param("id")); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// =============================================================================
// Member ProductVariation Handlers
// =============================================================================

func (h *VariationHandler) MemberCreateProductVariation(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	var req createProductVariationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.ProductID) == "" || strings.TrimSpace(req.SKU) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id and sku are required"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	pv := &catalogmodels.ProductVariation{
		ID:               id,
		ProductID:        req.ProductID,
		SKU:              strings.TrimSpace(req.SKU),
		Price:            req.Price,
		ComparePrice:     req.ComparePrice,
		Weight:           req.Weight,
		DimensionsLength: req.DimensionsLength,
		DimensionsWidth:  req.DimensionsWidth,
		DimensionsHeight: req.DimensionsHeight,
		IsDefault:        req.IsDefault,
		IsActive:         req.IsActive,
	}

	if err := h.svc.CreateProductVariationForMember(c.Request.Context(), memberID, pv, req.AttributeIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pv)
}

func (h *VariationHandler) MemberGetProductVariation(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	pv, err := h.svc.GetProductVariationByIDForMember(c.Request.Context(), memberID, c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pv)
}

func (h *VariationHandler) MemberListProductVariations(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	productID := c.Query("product_id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id query param is required"})
		return
	}

	variations, err := h.svc.ListProductVariationsByProductIDForMember(c.Request.Context(), memberID, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, variations)
}

func (h *VariationHandler) MemberUpdateProductVariation(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateProductVariationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pv, err := h.svc.GetProductVariationByIDForMember(c.Request.Context(), memberID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.SKU != nil && strings.TrimSpace(*req.SKU) != "" {
		pv.SKU = strings.TrimSpace(*req.SKU)
	}
	if req.Price != nil {
		pv.Price = *req.Price
	}
	if req.ComparePrice != nil {
		pv.ComparePrice = req.ComparePrice
	}
	if req.Weight != nil {
		pv.Weight = req.Weight
	}
	if req.DimensionsLength != nil {
		pv.DimensionsLength = req.DimensionsLength
	}
	if req.DimensionsWidth != nil {
		pv.DimensionsWidth = req.DimensionsWidth
	}
	if req.DimensionsHeight != nil {
		pv.DimensionsHeight = req.DimensionsHeight
	}
	if req.IsDefault != nil {
		pv.IsDefault = *req.IsDefault
	}
	if req.IsActive != nil {
		pv.IsActive = *req.IsActive
	}

	attributeIDs := []string{}
	if req.AttributeIDs != nil {
		attributeIDs = *req.AttributeIDs
	}

	if err := h.svc.UpdateProductVariationForMember(c.Request.Context(), memberID, pv, attributeIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pv)
}

func (h *VariationHandler) MemberDeleteProductVariation(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	if err := h.svc.DeleteProductVariationForMember(c.Request.Context(), memberID, c.Param("id")); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *VariationHandler) MemberUpdateVariationAssets(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateVariationAssetsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateVariationAssetsForMember(c.Request.Context(), memberID, id, req.AssetIDs); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.svc.GetProductVariationByIDForMember(c.Request.Context(), memberID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *VariationHandler) MemberGetVariationByAttributes(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member context unavailable"})
		return
	}

	productID := c.Query("product_id")
	attributeIDsStr := c.Query("attribute_ids")
	if productID == "" || attributeIDsStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id and attribute_ids are required"})
		return
	}

	attributeIDs := strings.Split(attributeIDsStr, ",")
	for i := range attributeIDs {
		attributeIDs[i] = strings.TrimSpace(attributeIDs[i])
	}

	pv, err := h.svc.GetVariationByAttributesForMember(c.Request.Context(), memberID, productID, attributeIDs)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pv)
}

// ListAttributesByGroup lists attributes in a group.
func (h *VariationHandler) ListAttributesByGroup(c *gin.Context) {
	groupID := c.Param("id")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	includeInactive := c.Query("include_inactive") == "true"

	attrs, err := h.svc.ListAttributesByGroupID(c.Request.Context(), groupID, includeInactive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attrs)
}

// UpdateAttribute updates an attribute.
func (h *VariationHandler) UpdateAttribute(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateAttributeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	attr, err := h.svc.GetAttributeByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attribute not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Apply partial updates
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		attr.Name = strings.TrimSpace(*req.Name)
	}
	if req.Slug != nil {
		attr.Slug = strings.TrimSpace(*req.Slug)
	}
	if req.Description != nil {
		attr.Description = req.Description
	}
	if req.DisplayOrder != nil {
		attr.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		attr.IsActive = *req.IsActive
	}

	if err := h.svc.UpdateAttribute(c.Request.Context(), attr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attr)
}

// DeleteAttribute soft-deletes an attribute.
func (h *VariationHandler) DeleteAttribute(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	if err := h.svc.DeleteAttribute(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// =============================================================================
// ProductVariation Handlers
// =============================================================================

// CreateProductVariation creates a new product variation.
func (h *VariationHandler) CreateProductVariation(c *gin.Context) {
	var req createProductVariationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.ProductID) == "" || strings.TrimSpace(req.SKU) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id and sku are required"})
		return
	}

	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}

	pv := &catalogmodels.ProductVariation{
		ID:               id,
		ProductID:        req.ProductID,
		SKU:              strings.TrimSpace(req.SKU),
		Price:            req.Price,
		ComparePrice:     req.ComparePrice,
		Weight:           req.Weight,
		DimensionsLength: req.DimensionsLength,
		DimensionsWidth:  req.DimensionsWidth,
		DimensionsHeight: req.DimensionsHeight,
		IsDefault:        req.IsDefault,
		IsActive:         req.IsActive,
	}

	if err := h.svc.CreateProductVariation(c.Request.Context(), pv, req.AttributeIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pv)
}

// GetProductVariation retrieves a variation by ID.
func (h *VariationHandler) GetProductVariation(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	pv, err := h.svc.GetProductVariationByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pv)
}

// ListProductVariations lists variations for a product.
func (h *VariationHandler) ListProductVariations(c *gin.Context) {
	productID := c.Query("product_id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id query param is required"})
		return
	}

	variations, err := h.svc.ListProductVariationsByProductID(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, variations)
}

// UpdateProductVariation updates a variation.
func (h *VariationHandler) UpdateProductVariation(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateProductVariationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pv, err := h.svc.GetProductVariationByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Apply partial updates
	if req.SKU != nil && strings.TrimSpace(*req.SKU) != "" {
		pv.SKU = strings.TrimSpace(*req.SKU)
	}
	if req.Price != nil {
		pv.Price = *req.Price
	}
	if req.ComparePrice != nil {
		pv.ComparePrice = req.ComparePrice
	}
	if req.Weight != nil {
		pv.Weight = req.Weight
	}
	if req.DimensionsLength != nil {
		pv.DimensionsLength = req.DimensionsLength
	}
	if req.DimensionsWidth != nil {
		pv.DimensionsWidth = req.DimensionsWidth
	}
	if req.DimensionsHeight != nil {
		pv.DimensionsHeight = req.DimensionsHeight
	}
	if req.IsDefault != nil {
		pv.IsDefault = *req.IsDefault
	}
	if req.IsActive != nil {
		pv.IsActive = *req.IsActive
	}

	attributeIDs := []string{}
	if req.AttributeIDs != nil {
		attributeIDs = *req.AttributeIDs
	}

	if err := h.svc.UpdateProductVariation(c.Request.Context(), pv, attributeIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pv)
}

// DeleteProductVariation soft-deletes a variation.
func (h *VariationHandler) DeleteProductVariation(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	if err := h.svc.DeleteProductVariation(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// UpdateVariationAssets replaces asset mappings for a variation.
func (h *VariationHandler) UpdateVariationAssets(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	var req updateVariationAssetsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pv, err := h.svc.GetProductVariationByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateVariationAssets(c.Request.Context(), id, pv.ProductID, req.AssetIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.svc.GetProductVariationByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// GetVariationByAttributes retrieves a variation by product and attribute IDs.
func (h *VariationHandler) GetVariationByAttributes(c *gin.Context) {
	productID := c.Query("product_id")
	attributeIDsStr := c.Query("attribute_ids")

	if productID == "" || attributeIDsStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id and attribute_ids are required"})
		return
	}

	// Parse comma-separated attribute IDs
	attributeIDs := strings.Split(attributeIDsStr, ",")
	for i := range attributeIDs {
		attributeIDs[i] = strings.TrimSpace(attributeIDs[i])
	}

	if len(attributeIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "attribute_ids cannot be empty"})
		return
	}

	pv, err := h.svc.GetVariationByAttributes(c.Request.Context(), productID, attributeIDs)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pv)
}
