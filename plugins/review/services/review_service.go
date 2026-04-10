package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"go_framework/internal/uuid"
	ordermodels "go_framework/plugins/order/models"
	reviewmodels "go_framework/plugins/review/models"

	"gorm.io/gorm"
)

var ErrOrderNotFound = errors.New("order not found")
var ErrOrderNotEligible = errors.New("order is not eligible for review")
var ErrOrderItemNotFound = errors.New("order item not found")
var ErrItemNotReviewable = errors.New("order item is not reviewable")
var ErrInvalidRating = errors.New("rating must be between 1 and 5")

// ReviewableItem represents an order item and current review state for customer review UI.
type ReviewableItem struct {
	OrderItemID string                       `json:"order_item_id"`
	ProductID   *string                      `json:"product_id,omitempty"`
	ProductName string                       `json:"product_name"`
	SKU         *string                      `json:"sku,omitempty"`
	CanReview   bool                         `json:"can_review"`
	Reason      string                       `json:"reason,omitempty"`
	Review      *reviewmodels.CustomerReview `json:"review,omitempty"`
}

type UpsertReviewInput struct {
	Rating       int
	ReviewText   string
	QuestionText string
}

type ProductReviewListFilter struct {
	Page  int
	Limit int
}

type PublicProductReview struct {
	ID           string    `json:"id"`
	ProductID    string    `json:"product_id"`
	Rating       int       `json:"rating"`
	ReviewText   string    `json:"review_text"`
	QuestionText string    `json:"question_text"`
	SellerReply  *string   `json:"seller_reply,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ReviewService struct {
	DB *gorm.DB
}

func New(db *gorm.DB) *ReviewService {
	return &ReviewService{DB: db}
}

func isOrderEligibleForReview(order *ordermodels.Order) bool {
	if order == nil {
		return false
	}
	status := strings.ToLower(strings.TrimSpace(order.Status))
	paymentStatus := strings.ToLower(strings.TrimSpace(order.PaymentStatus))
	if order.PaidAt != nil {
		return true
	}
	if paymentStatus == "paid" || paymentStatus == "completed" || paymentStatus == "confirmed" {
		return true
	}
	if status == "paid" || status == "completed" || status == "confirmed" {
		return true
	}
	return false
}

func (s *ReviewService) getOwnedOrder(ctx context.Context, customerID, orderID string) (*ordermodels.Order, error) {
	var order ordermodels.Order
	err := s.DB.WithContext(ctx).
		Where("id = ? AND customer_id = ?", strings.TrimSpace(orderID), strings.TrimSpace(customerID)).
		First(&order).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}
	return &order, nil
}

func (s *ReviewService) ListMyOrderReviewableItems(ctx context.Context, customerID, orderID string) ([]ReviewableItem, error) {
	order, err := s.getOwnedOrder(ctx, customerID, orderID)
	if err != nil {
		return nil, err
	}

	var items []ordermodels.OrderItem
	if err := s.DB.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("created_at ASC").
		Find(&items).Error; err != nil {
		return nil, err
	}

	var reviews []reviewmodels.CustomerReview
	if err := s.DB.WithContext(ctx).
		Where("order_id = ? AND customer_id = ?", order.ID, strings.TrimSpace(customerID)).
		Find(&reviews).Error; err != nil {
		return nil, err
	}
	reviewByItemID := make(map[string]reviewmodels.CustomerReview, len(reviews))
	for _, rv := range reviews {
		reviewByItemID[rv.OrderItemID] = rv
	}

	eligible := isOrderEligibleForReview(order)
	result := make([]ReviewableItem, 0, len(items))
	for _, item := range items {
		entry := ReviewableItem{
			OrderItemID: item.ID,
			ProductID:   item.ProductID,
			ProductName: strings.TrimSpace(item.ProductName),
			SKU:         item.SKU,
			CanReview:   eligible,
		}
		if !eligible {
			entry.Reason = "order belum selesai atau belum dibayar"
		}
		if item.ProductID == nil || strings.TrimSpace(*item.ProductID) == "" {
			entry.CanReview = false
			entry.Reason = "item tidak terhubung ke produk"
		}
		if rv, ok := reviewByItemID[item.ID]; ok {
			copy := rv
			entry.Review = &copy
		}
		result = append(result, entry)
	}
	return result, nil
}

func (s *ReviewService) UpsertMyOrderItemReview(ctx context.Context, customerID, orderID, orderItemID string, input UpsertReviewInput) (*reviewmodels.CustomerReview, error) {
	input.ReviewText = strings.TrimSpace(input.ReviewText)
	input.QuestionText = strings.TrimSpace(input.QuestionText)
	if input.Rating < 1 || input.Rating > 5 {
		return nil, ErrInvalidRating
	}

	order, err := s.getOwnedOrder(ctx, customerID, orderID)
	if err != nil {
		return nil, err
	}
	if !isOrderEligibleForReview(order) {
		return nil, ErrOrderNotEligible
	}

	var item ordermodels.OrderItem
	if err := s.DB.WithContext(ctx).
		Where("id = ? AND order_id = ?", strings.TrimSpace(orderItemID), order.ID).
		First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderItemNotFound
		}
		return nil, err
	}
	if item.ProductID == nil || strings.TrimSpace(*item.ProductID) == "" {
		return nil, ErrItemNotReviewable
	}

	now := time.Now()
	var review reviewmodels.CustomerReview
	err = s.DB.WithContext(ctx).
		Where("order_item_id = ? AND customer_id = ?", item.ID, strings.TrimSpace(customerID)).
		First(&review).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		newID, idErr := uuid.New()
		if idErr != nil {
			return nil, idErr
		}
		review = reviewmodels.CustomerReview{
			ID:           newID,
			OrderID:      order.ID,
			OrderItemID:  item.ID,
			ProductID:    strings.TrimSpace(*item.ProductID),
			CustomerID:   strings.TrimSpace(customerID),
			Rating:       input.Rating,
			ReviewText:   input.ReviewText,
			QuestionText: input.QuestionText,
			Status:       "published",
			IsVisible:    true,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if createErr := s.DB.WithContext(ctx).Create(&review).Error; createErr != nil {
			return nil, createErr
		}
		return &review, nil
	}

	updates := map[string]any{
		"rating":        input.Rating,
		"review_text":   input.ReviewText,
		"question_text": input.QuestionText,
		"updated_at":    now,
	}
	if updateErr := s.DB.WithContext(ctx).
		Model(&reviewmodels.CustomerReview{}).
		Where("id = ?", review.ID).
		Updates(updates).Error; updateErr != nil {
		return nil, updateErr
	}
	if err := s.DB.WithContext(ctx).Where("id = ?", review.ID).First(&review).Error; err != nil {
		return nil, err
	}
	return &review, nil
}

func (s *ReviewService) ListPublicProductReviews(ctx context.Context, productID string, filter ProductReviewListFilter) ([]PublicProductReview, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	limit := filter.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	query := s.DB.WithContext(ctx).
		Table("customer_reviews").
		Where("product_id = ? AND status = ? AND is_visible = ?", strings.TrimSpace(productID), "published", true)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []PublicProductReview
	if err := query.
		Select("id, product_id, rating, review_text, question_text, seller_reply, created_at, updated_at").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

type ProductReviewStats struct {
	TotalReviews  int64         `json:"total_reviews"`
	AverageRating float64       `json:"average_rating"`
	RatingCount   map[int]int64 `json:"rating_count"`
}

func (s *ReviewService) GetProductReviewStats(ctx context.Context, productID string) (*ProductReviewStats, error) {
	productID = strings.TrimSpace(productID)

	var total int64
	var avgRating float64
	if err := s.DB.WithContext(ctx).
		Table("customer_reviews").
		Where("product_id = ? AND status = ? AND is_visible = ?", productID, "published", true).
		Count(&total).Error; err != nil {
		return nil, err
	}

	if total == 0 {
		return &ProductReviewStats{
			TotalReviews:  0,
			AverageRating: 0,
			RatingCount:   make(map[int]int64),
		}, nil
	}

	if err := s.DB.WithContext(ctx).
		Table("customer_reviews").
		Where("product_id = ? AND status = ? AND is_visible = ?", productID, "published", true).
		Select("COALESCE(AVG(rating), 0)").
		Row().
		Scan(&avgRating); err != nil {
		return nil, err
	}

	type ratingCount struct {
		Rating int
		Count  int64
	}
	var counts []ratingCount
	if err := s.DB.WithContext(ctx).
		Table("customer_reviews").
		Where("product_id = ? AND status = ? AND is_visible = ?", productID, "published", true).
		Select("rating, COUNT(*) as count").
		Group("rating").
		Order("rating DESC").
		Scan(&counts).Error; err != nil {
		return nil, err
	}

	ratingCountMap := make(map[int]int64)
	for _, rc := range counts {
		ratingCountMap[rc.Rating] = rc.Count
	}

	return &ProductReviewStats{
		TotalReviews:  total,
		AverageRating: avgRating,
		RatingCount:   ratingCountMap,
	}, nil
}

var ErrReviewNotFound = errors.New("review not found")
var ErrInvalidReply = errors.New("seller reply cannot be empty")

func (s *ReviewService) UpdateSellerReply(ctx context.Context, reviewID, sellerReply string) (*reviewmodels.CustomerReview, error) {
	reviewID = strings.TrimSpace(reviewID)
	sellerReply = strings.TrimSpace(sellerReply)

	if sellerReply == "" {
		return nil, ErrInvalidReply
	}

	var review reviewmodels.CustomerReview
	if err := s.DB.WithContext(ctx).
		Where("id = ?", reviewID).
		First(&review).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReviewNotFound
		}
		return nil, err
	}

	now := time.Now()
	updates := map[string]any{
		"seller_reply":    sellerReply,
		"seller_reply_at": now,
		"updated_at":      now,
	}
	if err := s.DB.WithContext(ctx).
		Model(&reviewmodels.CustomerReview{}).
		Where("id = ?", reviewID).
		Updates(updates).Error; err != nil {
		return nil, err
	}

	if err := s.DB.WithContext(ctx).Where("id = ?", reviewID).First(&review).Error; err != nil {
		return nil, err
	}
	return &review, nil
}
