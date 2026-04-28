package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type BusinessHandler struct {
	svc *catalogservices.CatalogService
}

func memberIDFromContext(c *gin.Context) (string, bool) {
	memberID := strings.TrimSpace(c.GetString("member_id"))
	if memberID == "" {
		return "", false
	}
	return memberID, true
}

type businessRequest struct {
	Name              string          `json:"name"`
	Slug              string          `json:"slug"`
	Description       *string         `json:"description"`
	ShortDescription  *string         `json:"short_description"`
	DescriptionHTML   *string         `json:"description_html"`
	DescriptionPlain  *string         `json:"description_plain"`
	DescriptionBlocks json.RawMessage `json:"description_blocks"`
	Highlights        json.RawMessage `json:"highlights"`
	OwnerName         *string         `json:"owner_name"`
	OwnerRole         *string         `json:"owner_role"`
	FoundedYear       *int            `json:"founded_year"`
	Address           *string         `json:"address"`
	OperationalHours  json.RawMessage `json:"operational_hours"`
	ChatResponseTime  *string         `json:"chat_response_time"`
	Email             *string         `json:"email"`
	Phone             *string         `json:"phone"`
	Facebook          *string         `json:"facebook"`
	Instagram         *string         `json:"instagram"`
	XTwitter          *string         `json:"x_twitter"`
	Tiktok            *string         `json:"tiktok"`
	WhatsApp          *string         `json:"whatsapp"`
	ShowContactEmail  *bool           `json:"show_contact_email"`
	ShowPhone         *bool           `json:"show_phone"`
}

func NewBusinessHandler(svc *catalogservices.CatalogService) *BusinessHandler {
	return &BusinessHandler{svc: svc}
}

func (h *BusinessHandler) Create(c *gin.Context) {
	var req businessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	highlightsJSON, err := normalizeRawJSON(req.Highlights)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	operationalJSON, err := normalizeRawJSON(req.OperationalHours)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	showEmail := true
	if req.ShowContactEmail != nil {
		showEmail = *req.ShowContactEmail
	}
	showPhone := true
	if req.ShowPhone != nil {
		showPhone = *req.ShowPhone
	}
	item := &catalogmodels.Business{
		ID:                id,
		Name:              req.Name,
		Slug:              req.Slug,
		Description:       req.Description,
		ShortDescription:  req.ShortDescription,
		DescriptionHTML:   req.DescriptionHTML,
		DescriptionPlain:  req.DescriptionPlain,
		DescriptionBlocks: blocksJSON,
		Highlights:        highlightsJSON,
		OwnerName:         req.OwnerName,
		OwnerRole:         req.OwnerRole,
		FoundedYear:       req.FoundedYear,
		Address:           req.Address,
		OperationalHours:  operationalJSON,
		ChatResponseTime:  req.ChatResponseTime,
		Email:             req.Email,
		Phone:             req.Phone,
		Facebook:          req.Facebook,
		Instagram:         req.Instagram,
		XTwitter:          req.XTwitter,
		Tiktok:            req.Tiktok,
		WhatsApp:          req.WhatsApp,
		ShowContactEmail:  showEmail,
		ShowPhone:         showPhone,
	}
	if err := h.svc.CreateBusiness(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *BusinessHandler) List(c *gin.Context) {
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 20)

	items, total, err := h.svc.ListBusinesses(c.Request.Context(), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *BusinessHandler) GetByID(c *gin.Context) {
	item, err := h.svc.GetBusinessByID(c.Request.Context(), c.Param("business_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	locale := strings.TrimSpace(c.Query("locale"))
	if locale != "" {
		translationMap, err := h.svc.GetBusinessTranslationMapByBusinessIDs(c.Request.Context(), []string{item.ID}, locale)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if tr, ok := translationMap[item.ID]; ok {
			applyBusinessTranslation(item, tr)
		}
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessHandler) Update(c *gin.Context) {
	item, err := h.svc.GetBusinessByID(c.Request.Context(), c.Param("business_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var req businessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Slug != "" {
		item.Slug = req.Slug
	}
	item.Description = req.Description
	if req.ShortDescription != nil {
		item.ShortDescription = req.ShortDescription
	}
	if req.DescriptionHTML != nil {
		item.DescriptionHTML = req.DescriptionHTML
	}
	if req.DescriptionPlain != nil {
		item.DescriptionPlain = req.DescriptionPlain
	}
	if len(req.DescriptionBlocks) > 0 {
		blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.DescriptionBlocks = blocksJSON
	}
	if len(req.Highlights) > 0 {
		highlightsJSON, err := normalizeRawJSON(req.Highlights)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.Highlights = highlightsJSON
	}
	if req.OwnerName != nil {
		item.OwnerName = req.OwnerName
	}
	if req.OwnerRole != nil {
		item.OwnerRole = req.OwnerRole
	}
	if req.FoundedYear != nil {
		item.FoundedYear = req.FoundedYear
	}
	if req.Address != nil {
		item.Address = req.Address
	}
	if len(req.OperationalHours) > 0 {
		operationalJSON, err := normalizeRawJSON(req.OperationalHours)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.OperationalHours = operationalJSON
	}
	if req.ChatResponseTime != nil {
		item.ChatResponseTime = req.ChatResponseTime
	}
	if req.Email != nil {
		item.Email = req.Email
	}
	if req.Phone != nil {
		item.Phone = req.Phone
	}
	if req.Facebook != nil {
		item.Facebook = req.Facebook
	}
	if req.Instagram != nil {
		item.Instagram = req.Instagram
	}
	if req.XTwitter != nil {
		item.XTwitter = req.XTwitter
	}
	if req.Tiktok != nil {
		item.Tiktok = req.Tiktok
	}
	if req.WhatsApp != nil {
		item.WhatsApp = req.WhatsApp
	}
	if req.ShowContactEmail != nil {
		item.ShowContactEmail = *req.ShowContactEmail
	}
	if req.ShowPhone != nil {
		item.ShowPhone = *req.ShowPhone
	}
	if err := h.svc.UpdateBusiness(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessHandler) Delete(c *gin.Context) {
	affected, err := h.svc.DeleteBusinessByID(c.Request.Context(), c.Param("business_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

func (h *BusinessHandler) MemberList(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), 20)

	items, total, err := h.svc.ListBusinessesForMember(c.Request.Context(), memberID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *BusinessHandler) MemberGetByID(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	item, err := h.svc.GetBusinessByIDForMember(c.Request.Context(), memberID, c.Param("business_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessHandler) MemberCreate(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	var req businessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	id, err := uuid.New()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
		return
	}
	highlightsJSON, err := normalizeRawJSON(req.Highlights)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	operationalJSON, err := normalizeRawJSON(req.OperationalHours)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	showEmail := true
	if req.ShowContactEmail != nil {
		showEmail = *req.ShowContactEmail
	}
	showPhone := true
	if req.ShowPhone != nil {
		showPhone = *req.ShowPhone
	}
	item := &catalogmodels.Business{
		ID:                id,
		Name:              req.Name,
		Slug:              req.Slug,
		Description:       req.Description,
		ShortDescription:  req.ShortDescription,
		DescriptionHTML:   req.DescriptionHTML,
		DescriptionPlain:  req.DescriptionPlain,
		DescriptionBlocks: blocksJSON,
		Highlights:        highlightsJSON,
		OwnerName:         req.OwnerName,
		OwnerRole:         req.OwnerRole,
		FoundedYear:       req.FoundedYear,
		Address:           req.Address,
		OperationalHours:  operationalJSON,
		ChatResponseTime:  req.ChatResponseTime,
		Email:             req.Email,
		Phone:             req.Phone,
		Facebook:          req.Facebook,
		Instagram:         req.Instagram,
		XTwitter:          req.XTwitter,
		Tiktok:            req.Tiktok,
		WhatsApp:          req.WhatsApp,
		ShowContactEmail:  showEmail,
		ShowPhone:         showPhone,
	}
	if err := h.svc.CreateBusinessForMember(c.Request.Context(), memberID, item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *BusinessHandler) MemberUpdate(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	item, err := h.svc.GetBusinessByIDForMember(c.Request.Context(), memberID, c.Param("business_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var req businessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Slug != "" {
		item.Slug = req.Slug
	}
	item.Description = req.Description
	if req.ShortDescription != nil {
		item.ShortDescription = req.ShortDescription
	}
	if req.DescriptionHTML != nil {
		item.DescriptionHTML = req.DescriptionHTML
	}
	if req.DescriptionPlain != nil {
		item.DescriptionPlain = req.DescriptionPlain
	}
	if len(req.DescriptionBlocks) > 0 {
		blocksJSON, err := normalizeRawJSON(req.DescriptionBlocks)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.DescriptionBlocks = blocksJSON
	}
	if len(req.Highlights) > 0 {
		highlightsJSON, err := normalizeRawJSON(req.Highlights)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.Highlights = highlightsJSON
	}
	if req.OwnerName != nil {
		item.OwnerName = req.OwnerName
	}
	if req.OwnerRole != nil {
		item.OwnerRole = req.OwnerRole
	}
	if req.FoundedYear != nil {
		item.FoundedYear = req.FoundedYear
	}
	if req.Address != nil {
		item.Address = req.Address
	}
	if len(req.OperationalHours) > 0 {
		operationalJSON, err := normalizeRawJSON(req.OperationalHours)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		item.OperationalHours = operationalJSON
	}
	if req.ChatResponseTime != nil {
		item.ChatResponseTime = req.ChatResponseTime
	}
	if req.Email != nil {
		item.Email = req.Email
	}
	if req.Phone != nil {
		item.Phone = req.Phone
	}
	if req.Facebook != nil {
		item.Facebook = req.Facebook
	}
	if req.Instagram != nil {
		item.Instagram = req.Instagram
	}
	if req.XTwitter != nil {
		item.XTwitter = req.XTwitter
	}
	if req.Tiktok != nil {
		item.Tiktok = req.Tiktok
	}
	if req.WhatsApp != nil {
		item.WhatsApp = req.WhatsApp
	}
	if req.ShowContactEmail != nil {
		item.ShowContactEmail = *req.ShowContactEmail
	}
	if req.ShowPhone != nil {
		item.ShowPhone = *req.ShowPhone
	}
	if err := h.svc.UpdateBusinessForMember(c.Request.Context(), memberID, item); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BusinessHandler) MemberDelete(c *gin.Context) {
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	affected, err := h.svc.DeleteBusinessByIDForMember(c.Request.Context(), memberID, c.Param("business_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": affected})
}

// PublicGetBySlug returns business data by slug for public usage (used by /b/:slug)
func (h *BusinessHandler) PublicGetBySlug(c *gin.Context) {
	slug := c.Param("slug")
	item, err := h.svc.GetBusinessBySlug(c.Request.Context(), slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	locale := strings.TrimSpace(c.Query("locale"))
	if locale != "" {
		translationMap, err := h.svc.GetBusinessTranslationMapByBusinessIDs(c.Request.Context(), []string{item.ID}, locale)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if tr, ok := translationMap[item.ID]; ok {
			applyBusinessTranslation(item, tr)
		}
	}

	// assets are preloaded by service; ensure public_url is absolute
	base := strings.TrimRight(os.Getenv("APP_URL"), "/")
	for i := range item.Assets {
		if item.Assets[i].PublicURL != "" && strings.HasPrefix(item.Assets[i].PublicURL, "/") {
			item.Assets[i].PublicURL = base + item.Assets[i].PublicURL
			continue
		}
		if item.Assets[i].FilePath != "" && item.Assets[i].PublicURL == "" {
			if full, err := h.svc.Store.PublicURL(c.Request.Context(), item.Assets[i].FilePath); err == nil {
				item.Assets[i].PublicURL = full
			}
		}
	}

	// Fetch published products for this business and include lightweight product info
	products, _, pErr := h.svc.ListProducts(c.Request.Context(), catalogservices.ProductListFilter{
		BusinessID:    item.ID,
		OnlyPublished: true,
		Limit:         100,
	})
	var productsOut []map[string]interface{}
	if pErr == nil && len(products) > 0 {
		ids := make([]string, 0, len(products))
		for _, p := range products {
			ids = append(ids, p.ID)
		}

		translationMap, _ := h.svc.GetProductTranslationMapByProductIDs(c.Request.Context(), ids, locale)
		categoryMap, _ := h.svc.GetCategoryIDsByProductIDs(c.Request.Context(), ids)
		tagMap, _ := h.svc.GetTagIDsByProductIDs(c.Request.Context(), ids)

		// preload active discounts for these products
		prodIDs := make([]string, 0, len(products))
		for _, p := range products {
			prodIDs = append(prodIDs, p.ID)
		}
		discountMap, _ := h.svc.GetActiveDiscountsForProductIDs(c.Request.Context(), prodIDs, item.ID)

		// preload gallery assets (usage_tag = 'gallery') for these products
		assetMap, _ := h.svc.GetProductAssetsForProductIDs(c.Request.Context(), prodIDs, "gallery")

		for _, p := range products {
			if tr, ok := translationMap[p.ID]; ok {
				if strings.TrimSpace(tr.Name) != "" {
					p.Name = tr.Name
				}
				if strings.TrimSpace(tr.Slug) != "" {
					p.Slug = tr.Slug
				}
				if tr.ShortDescription != nil {
					p.ShortDescription = tr.ShortDescription
				}
				// apply full description translations if available
				if tr.Description != nil {
					p.Description = tr.Description
				}
				if tr.DescriptionHTML != nil {
					p.DescriptionHTML = tr.DescriptionHTML
				}
				if tr.DescriptionPlain != nil {
					p.DescriptionPlain = tr.DescriptionPlain
				}
			}

			var categoryName string
			if catIDs, ok := categoryMap[p.ID]; ok && len(catIDs) > 0 {
				if catObj, err := h.svc.GetCategoryByID(c.Request.Context(), catIDs[0]); err == nil {
					if catTranslationMap, err := h.svc.GetCategoryTranslationMapByCategoryIDs(c.Request.Context(), []string{catObj.ID}, locale); err == nil {
						if tr, ok := catTranslationMap[catObj.ID]; ok {
							applyCategoryTranslation(catObj, tr)
						}
					}
					categoryName = catObj.Name
				}
			}

			excerpt := ""
			if p.ShortDescription != nil {
				excerpt = *p.ShortDescription
			} else if p.Description != nil {
				excerpt = *p.Description
			}

			// compute best discount (choose single best discount for now)
			originalPrice := p.Price
			finalPrice := originalPrice
			appliedIDs := []string{}
			badge := ""
			if ds, ok := discountMap[p.ID]; ok && len(ds) > 0 {
				bestPrice := originalPrice
				var bestDisc catalogmodels.Discount
				for _, d := range ds {
					var candidate float64
					if strings.ToLower(d.DiscountType) == "percentage" {
						pct := d.DiscountValue
						if pct < 0 {
							pct = 0
						}
						if pct > 100 {
							pct = 100
						}
						candidate = originalPrice * (1 - pct/100)
					} else {
						candidate = originalPrice - d.DiscountValue
					}
					if candidate < bestPrice {
						bestPrice = candidate
						bestDisc = d
					}
				}
				if bestPrice < originalPrice {
					finalPrice = bestPrice
					appliedIDs = append(appliedIDs, bestDisc.ID)
					if strings.ToLower(bestDisc.DiscountType) == "percentage" {
						badge = fmt.Sprintf("-%.0f%%", bestDisc.DiscountValue)
					} else {
						badge = fmt.Sprintf("-%g", bestDisc.DiscountValue)
					}
				}
			}

			// prepare description payloads
			rawDesc := ""
			rawDescHTML := ""
			rawDescPlain := ""
			if p.Description != nil {
				rawDesc = *p.Description
			}
			if p.DescriptionHTML != nil {
				rawDescHTML = *p.DescriptionHTML
			}
			if p.DescriptionPlain != nil {
				rawDescPlain = *p.DescriptionPlain
			}

			productsOut = append(productsOut, map[string]interface{}{
				"id":                   p.ID,
				"title":                p.Name,
				"slug":                 p.Slug,
				"category":             categoryName,
				"original_price":       originalPrice,
				"discounted_price":     finalPrice,
				"discount_badge":       badge,
				"applied_discount_ids": appliedIDs,
				"excerpt":              excerpt,
				"description":          rawDesc,
				"description_html":     rawDescHTML,
				"description_plain":    rawDescPlain,
				"tag_ids":              tagMap[p.ID],
				// gallery: array of product asset objects with public URLs
				"gallery": func() []map[string]interface{} {
					out := []map[string]interface{}{}
					if assets, ok := assetMap[p.ID]; ok && len(assets) > 0 {
						for _, a := range assets {
							pub := a.PublicURL
							if pub != "" && strings.HasPrefix(pub, "/") {
								pub = base + pub
							} else if a.FilePath != "" && pub == "" {
								if full, err := h.svc.Store.PublicURL(c.Request.Context(), a.FilePath); err == nil {
									pub = full
								}
							}
							out = append(out, map[string]interface{}{
								"id":            a.ID,
								"file_path":     a.FilePath,
								"public_url":    pub,
								"is_main":       a.IsMain,
								"usage_tag":     a.UsageTag,
								"display_order": a.DisplayOrder,
							})
						}
					}
					return out
				}(),
			})
		}
	}

	// include active disclaimers for public consumption
	disclaimers, err := h.svc.GetActiveDisclaimersForBusiness(c.Request.Context(), item.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(disclaimers) > 0 {
		itemIDs := make([]string, 0, len(disclaimers))
		for _, disclaimer := range disclaimers {
			itemIDs = append(itemIDs, disclaimer.ID)
		}
		translations, err := h.svc.GetBusinessDisclaimerTranslationMapByDisclaimerIDs(c.Request.Context(), itemIDs, locale)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for index := range disclaimers {
			if translation, ok := translations[disclaimers[index].ID]; ok {
				applyBusinessDisclaimerTranslation(&disclaimers[index], translation)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": item, "assets": item.Assets, "products": productsOut, "disclaimers": disclaimers})
}

func normalizeRawJSON(raw json.RawMessage) (datatypes.JSON, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, nil
	}
	trimmed := bytes.TrimSpace(raw)
	if !json.Valid(trimmed) {
		return nil, fmt.Errorf("invalid JSON payload")
	}
	return datatypes.JSON(trimmed), nil
}
