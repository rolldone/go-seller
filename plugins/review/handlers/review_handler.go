package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	reviewservices "go_framework/plugins/review/services"

	authhandlers "go_framework/plugins/auth/handlers"

	"github.com/gin-gonic/gin"
)

type ReviewHandler struct {
	svc *reviewservices.ReviewService
}

func NewReviewHandler(svc *reviewservices.ReviewService) *ReviewHandler {
	return &ReviewHandler{svc: svc}
}

func getCustomerID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString("customer_id"))
}

type upsertReviewRequest struct {
	Rating       int    `json:"rating" binding:"required"`
	ReviewText   string `json:"review_text"`
	QuestionText string `json:"question_text"`
}

func parseReviewMultipart(c *gin.Context) (reviewservices.UpsertReviewInput, error) {
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		return reviewservices.UpsertReviewInput{}, err
	}
	rating, err := strconv.Atoi(strings.TrimSpace(c.PostForm("rating")))
	if err != nil {
		return reviewservices.UpsertReviewInput{}, errors.New("rating is required")
	}
	input := reviewservices.UpsertReviewInput{
		Rating:       rating,
		ReviewText:   c.PostForm("review_text"),
		QuestionText: c.PostForm("question_text"),
	}
	form := c.Request.MultipartForm
	if form != nil {
		files := form.File["attachments"]
		if len(files) == 0 {
			files = form.File["attachments[]"]
		}
		if len(files) > 0 {
			if len(files) > 5 {
				return reviewservices.UpsertReviewInput{}, errors.New("maksimal 5 file lampiran")
			}
			input.Attachments = files
		}
	}
	return input, nil
}

func (h *ReviewHandler) RegisterRoutes(admin *gin.RouterGroup, api *gin.RouterGroup) {
	if admin != nil {
		adminReview := admin.Group("/review")
		adminReview.Use(authhandlers.RequireAdminJWT())
		adminReview.GET("/health", HealthHandler)
		adminReview.GET("", h.ListAllProductReviews)
		adminReview.POST("/:review_id/reply", h.UpdateSellerReply)
	}
	if api == nil {
		return
	}

	apiReview := api.Group("/review")
	apiReview.GET("/businesses/:business_id", h.GetBusinessReviews)
	apiReview.GET("/products/:product_id", h.ListProductReviews)
	apiReview.GET("/products/:product_id/stats", h.GetProductReviewStats)

	my := apiReview.Group("/my")
	my.Use(authhandlers.RequireCustomerJWT())
	my.GET("/orders/:order_id/items", h.ListMyOrderItems)
	my.POST("/orders/:order_id/items/:item_id", h.UpsertMyOrderItemReview)
}

func (h *ReviewHandler) ListMyOrderItems(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	customerID := getCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer auth required"})
		return
	}
	orderID := strings.TrimSpace(c.Param("order_id"))
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id is required"})
		return
	}
	items, err := h.svc.ListMyOrderReviewableItems(c.Request.Context(), customerID, orderID)
	if err != nil {
		if errors.Is(err, reviewservices.ErrOrderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *ReviewHandler) UpsertMyOrderItemReview(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	customerID := getCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer auth required"})
		return
	}
	orderID := strings.TrimSpace(c.Param("order_id"))
	itemID := strings.TrimSpace(c.Param("item_id"))
	if orderID == "" || itemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id and item_id are required"})
		return
	}

	var req upsertReviewRequest
	var input reviewservices.UpsertReviewInput
	if strings.Contains(strings.ToLower(c.GetHeader("Content-Type")), "multipart/form-data") {
		parsed, parseErr := parseReviewMultipart(c)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": parseErr.Error()})
			return
		}
		input = parsed
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		input = reviewservices.UpsertReviewInput{
			Rating:       req.Rating,
			ReviewText:   req.ReviewText,
			QuestionText: req.QuestionText,
		}
	}
	review, err := h.svc.UpsertMyOrderItemReview(c.Request.Context(), customerID, orderID, itemID, input)
	if err != nil {
		switch {
		case errors.Is(err, reviewservices.ErrOrderNotFound), errors.Is(err, reviewservices.ErrOrderItemNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		case errors.Is(err, reviewservices.ErrOrderNotEligible), errors.Is(err, reviewservices.ErrItemNotReviewable), errors.Is(err, reviewservices.ErrInvalidRating):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": review})
}

func (h *ReviewHandler) ListProductReviews(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	productID := strings.TrimSpace(c.Param("product_id"))
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	items, total, err := h.svc.ListPublicProductReviews(c.Request.Context(), productID, reviewservices.ProductReviewListFilter{Page: page, Limit: limit})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 10
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total, "page": page, "limit": limit})
}

func (h *ReviewHandler) GetProductReviewStats(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	productID := strings.TrimSpace(c.Param("product_id"))
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id is required"})
		return
	}
	stats, err := h.svc.GetProductReviewStats(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": stats})
}

func (h *ReviewHandler) GetBusinessReviews(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	businessID := strings.TrimSpace(c.Param("business_id"))
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id is required"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	overview, err := h.svc.GetBusinessReviewOverview(c.Request.Context(), businessID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": overview})
}

func (h *ReviewHandler) ListAllProductReviews(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	productID := strings.TrimSpace(c.Query("product_id"))
	businessID := strings.TrimSpace(c.Query("business_id"))
	hasReplyParam := strings.TrimSpace(c.Query("has_reply"))

	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset := (page - 1) * limit
	query := h.svc.DB.WithContext(c.Request.Context()).
		Table("customer_reviews cr").
		Joins("JOIN orders o ON o.id = cr.order_id").
		Joins("LEFT JOIN businesses b ON b.id = o.business_id").
		Where("cr.status = ? AND cr.is_visible = ?", "published", true)

	if productID != "" {
		query = query.Where("cr.product_id = ?", productID)
	}
	if businessID != "" {
		query = query.Where("o.business_id = ?", businessID)
	}
	if hasReplyParam != "" {
		if hasReplyParam == "true" {
			query = query.Where("cr.seller_reply IS NOT NULL AND cr.seller_reply <> ''")
		} else if hasReplyParam == "false" {
			query = query.Where("cr.seller_reply IS NULL OR cr.seller_reply = ''")
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type reviewRow struct {
		ID            string          `json:"id"`
		ProductID     string          `json:"product_id"`
		Metadata      json.RawMessage `json:"metadata"`
		BusinessID    string          `json:"business_id"`
		BusinessName  string          `json:"business_name"`
		BusinessSlug  string          `json:"business_slug"`
		CustomerID    string          `json:"customer_id"`
		OrderID       string          `json:"order_id"`
		OrderItemID   string          `json:"order_item_id"`
		Rating        int             `json:"rating"`
		ReviewText    string          `json:"review_text"`
		QuestionText  string          `json:"question_text"`
		SellerReply   *string         `json:"seller_reply"`
		SellerReplyAt *time.Time      `json:"seller_reply_at"`
		Status        string          `json:"status"`
		IsVisible     bool            `json:"is_visible"`
		CreatedAt     time.Time       `json:"created_at"`
		UpdatedAt     time.Time       `json:"updated_at"`
	}

	var rows []reviewRow
	if err := query.
		Select("cr.id, cr.product_id, COALESCE(cr.metadata, '{}'::jsonb) AS metadata, COALESCE(o.business_id::text, '') AS business_id, COALESCE(b.name, '') AS business_name, COALESCE(b.slug, '') AS business_slug, cr.customer_id, cr.order_id, cr.order_item_id, cr.rating, cr.review_text, cr.question_text, cr.seller_reply, cr.seller_reply_at, cr.status, cr.is_visible, cr.created_at, cr.updated_at").
		Order("cr.created_at DESC").
		Offset(offset).
		Limit(limit).
		Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows, "total": total, "page": page, "limit": limit})
}

type updateSellerReplyRequest struct {
	SellerReply string `json:"seller_reply" binding:"required"`
}

func (h *ReviewHandler) UpdateSellerReply(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	reviewID := strings.TrimSpace(c.Param("review_id"))
	if reviewID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "review_id is required"})
		return
	}

	var req updateSellerReplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	review, err := h.svc.UpdateSellerReply(c.Request.Context(), reviewID, req.SellerReply)
	if err != nil {
		switch {
		case errors.Is(err, reviewservices.ErrReviewNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		case errors.Is(err, reviewservices.ErrInvalidReply):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": review})
}
