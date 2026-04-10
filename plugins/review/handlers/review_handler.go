package handlers

import (
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
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	review, err := h.svc.UpsertMyOrderItemReview(c.Request.Context(), customerID, orderID, itemID, reviewservices.UpsertReviewInput{
		Rating:       req.Rating,
		ReviewText:   req.ReviewText,
		QuestionText: req.QuestionText,
	})
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

func (h *ReviewHandler) ListAllProductReviews(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review service not configured"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	productID := strings.TrimSpace(c.Query("product_id"))
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
		Table("customer_reviews").
		Where("status = ? AND is_visible = ?", "published", true)

	if productID != "" {
		query = query.Where("product_id = ?", productID)
	}
	if hasReplyParam != "" {
		if hasReplyParam == "true" {
			query = query.Where("seller_reply IS NOT NULL AND seller_reply <> ''")
		} else if hasReplyParam == "false" {
			query = query.Where("seller_reply IS NULL OR seller_reply = ''")
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type reviewRow struct {
		ID            string     `json:"id"`
		ProductID     string     `json:"product_id"`
		CustomerID    string     `json:"customer_id"`
		OrderID       string     `json:"order_id"`
		OrderItemID   string     `json:"order_item_id"`
		Rating        int        `json:"rating"`
		ReviewText    string     `json:"review_text"`
		QuestionText  string     `json:"question_text"`
		SellerReply   *string    `json:"seller_reply"`
		SellerReplyAt *time.Time `json:"seller_reply_at"`
		Status        string     `json:"status"`
		IsVisible     bool       `json:"is_visible"`
		CreatedAt     time.Time  `json:"created_at"`
		UpdatedAt     time.Time  `json:"updated_at"`
	}

	var rows []reviewRow
	if err := query.
		Select("id, product_id, customer_id, order_id, order_item_id, rating, review_text, question_text, seller_reply, seller_reply_at, status, is_visible, created_at, updated_at").
		Order("created_at DESC").
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
