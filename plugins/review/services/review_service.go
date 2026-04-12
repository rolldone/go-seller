package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"go_framework/internal/storage"
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
var ErrReviewAttachmentTooLarge = errors.New("review attachment exceeds 10MB")
var ErrReviewAttachmentInvalidType = errors.New("review attachment must be an image or video file")

const reviewAttachmentMaxBytes int64 = 10 * 1024 * 1024

var reviewAttachmentAllowedExt = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
	".gif":  true,
	".mp4":  true,
	".webm": true,
	".mov":  true,
}

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
	Attachments  []*multipart.FileHeader
}

type ProductReviewListFilter struct {
	Page  int
	Limit int
}

type PublicProductReview struct {
	ID           string          `json:"id"`
	ProductID    string          `json:"product_id"`
	Rating       int             `json:"rating"`
	ReviewText   string          `json:"review_text"`
	QuestionText string          `json:"question_text"`
	SellerReply  *string         `json:"seller_reply,omitempty"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type PublicBusinessReviewBreakdown struct {
	Star  int   `json:"star"`
	Count int64 `json:"count"`
}

type PublicBusinessReviewSummary struct {
	Score            float64                         `json:"score"`
	OutOf            float64                         `json:"outOf"`
	SatisfiedPercent int                             `json:"satisfiedPercent"`
	RatingCount      int64                           `json:"ratingCount"`
	ReviewCount      int64                           `json:"reviewCount"`
	Breakdown        []PublicBusinessReviewBreakdown `json:"breakdown"`
}

type PublicBusinessReview struct {
	ID             string   `json:"id"`
	ProductID      string   `json:"productId"`
	ProductTitle   string   `json:"productTitle"`
	ProductVariant string   `json:"productVariant"`
	Rating         int      `json:"rating"`
	CreatedAtLabel string   `json:"createdAtLabel"`
	CreatedAt      string   `json:"createdAt,omitempty"`
	UsernameMasked string   `json:"usernameMasked"`
	Content        string   `json:"content"`
	HelpfulCount   int      `json:"helpfulCount"`
	HasMedia       bool     `json:"hasMedia"`
	Topics         []string `json:"topics,omitempty"`
}

type ReviewAttachment struct {
	Name           string `json:"name"`
	StorageKey     string `json:"storageKey"`
	PublicURL      string `json:"publicUrl"`
	MimeType       string `json:"mimeType"`
	FileSize       int64  `json:"fileSize"`
	ChecksumSHA256 string `json:"checksumSha256,omitempty"`
}

type PublicBusinessReviewOverview struct {
	Summary PublicBusinessReviewSummary `json:"summary"`
	Reviews []PublicBusinessReview      `json:"reviews"`
}

type ReviewService struct {
	DB    *gorm.DB
	Store storage.Store
}

func New(db *gorm.DB, store storage.Store) *ReviewService {
	return &ReviewService{DB: db, Store: store}
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

func detectReviewAttachmentMimeType(fileHeader *multipart.FileHeader) string {
	if fileHeader == nil {
		return "application/octet-stream"
	}
	mimeType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	if mimeType != "" {
		return mimeType
	}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext != "" {
		if detected := mime.TypeByExtension(ext); detected != "" {
			return detected
		}
	}
	return "application/octet-stream"
}

func validateReviewAttachmentFile(fileHeader *multipart.FileHeader) error {
	if fileHeader == nil {
		return errors.New("review attachment is required")
	}
	if fileHeader.Size <= 0 {
		return errors.New("review attachment is empty")
	}
	if fileHeader.Size > reviewAttachmentMaxBytes {
		return ErrReviewAttachmentTooLarge
	}
	if !reviewAttachmentAllowedExt[strings.ToLower(filepath.Ext(fileHeader.Filename))] {
		return ErrReviewAttachmentInvalidType
	}
	mimeType := detectReviewAttachmentMimeType(fileHeader)
	if strings.HasPrefix(mimeType, "image/") || strings.HasPrefix(mimeType, "video/") {
		return nil
	}
	return ErrReviewAttachmentInvalidType
}

func parseReviewAttachmentMetadata(raw []byte) []ReviewAttachment {
	if len(strings.TrimSpace(string(raw))) == 0 {
		return nil
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil
	}
	rawAttachments, ok := payload["attachments"]
	if !ok {
		return nil
	}
	items, ok := rawAttachments.([]any)
	if !ok {
		return nil
	}
	attachments := make([]ReviewAttachment, 0, len(items))
	for _, item := range items {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		attachment := ReviewAttachment{}
		if value, ok := entry["name"].(string); ok {
			attachment.Name = value
		}
		if value, ok := entry["storageKey"].(string); ok {
			attachment.StorageKey = value
		}
		if value, ok := entry["publicUrl"].(string); ok {
			attachment.PublicURL = value
		}
		if value, ok := entry["mimeType"].(string); ok {
			attachment.MimeType = value
		}
		switch value := entry["fileSize"].(type) {
		case float64:
			attachment.FileSize = int64(value)
		case int64:
			attachment.FileSize = value
		case int:
			attachment.FileSize = int64(value)
		}
		if value, ok := entry["checksumSha256"].(string); ok {
			attachment.ChecksumSHA256 = value
		}
		attachments = append(attachments, attachment)
	}
	return attachments
}

func buildReviewMetadata(existing []byte, attachments []ReviewAttachment) ([]byte, error) {
	payload := map[string]any{}
	if len(strings.TrimSpace(string(existing))) > 0 {
		if err := json.Unmarshal(existing, &payload); err != nil {
			payload = map[string]any{}
		}
	}
	if len(attachments) > 0 {
		payload["has_media"] = true
		payload["attachments"] = attachments
	}
	if len(payload) == 0 {
		return nil, nil
	}
	return json.Marshal(payload)
}

func (s *ReviewService) uploadReviewAttachment(ctx context.Context, reviewID, orderID, orderItemID string, fileHeader *multipart.FileHeader) (*ReviewAttachment, error) {
	if s.Store == nil {
		return nil, errors.New("storage is not configured")
	}
	if err := validateReviewAttachmentFile(fileHeader); err != nil {
		return nil, err
	}
	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded attachment: %w", err)
	}
	defer file.Close()

	body, err := io.ReadAll(io.LimitReader(file, reviewAttachmentMaxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read uploaded attachment: %w", err)
	}
	if int64(len(body)) > reviewAttachmentMaxBytes {
		return nil, ErrReviewAttachmentTooLarge
	}

	hash := sha256.Sum256(body)
	checksum := hex.EncodeToString(hash[:])
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		mimeType := detectReviewAttachmentMimeType(fileHeader)
		switch {
		case strings.HasPrefix(mimeType, "image/jpeg"):
			ext = ".jpg"
		case strings.HasPrefix(mimeType, "image/png"):
			ext = ".png"
		case strings.HasPrefix(mimeType, "image/webp"):
			ext = ".webp"
		case strings.HasPrefix(mimeType, "image/gif"):
			ext = ".gif"
		case strings.HasPrefix(mimeType, "video/mp4"):
			ext = ".mp4"
		case strings.HasPrefix(mimeType, "video/webm"):
			ext = ".webm"
		default:
			ext = ".bin"
		}
	}
	attachmentID, err := uuid.New()
	if err != nil {
		return nil, err
	}
	storageKey := fmt.Sprintf("reviews/%s/%s/%s/%s%s", orderID, orderItemID, reviewID, attachmentID, ext)
	if err := s.Store.Put(ctx, storageKey, bytes.NewReader(body)); err != nil {
		return nil, fmt.Errorf("failed to upload review attachment: %w", err)
	}
	publicURL, err := s.Store.PublicURL(ctx, storageKey)
	if err != nil {
		_ = s.Store.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to resolve review attachment URL: %w", err)
	}
	return &ReviewAttachment{
		Name:           fileHeader.Filename,
		StorageKey:     storageKey,
		PublicURL:      publicURL,
		MimeType:       detectReviewAttachmentMimeType(fileHeader),
		FileSize:       int64(len(body)),
		ChecksumSHA256: checksum,
	}, nil
}

func (s *ReviewService) deleteReviewAttachments(ctx context.Context, attachments []ReviewAttachment) {
	if s.Store == nil {
		return
	}
	for _, attachment := range attachments {
		if strings.TrimSpace(attachment.StorageKey) == "" {
			continue
		}
		_ = s.Store.Delete(ctx, attachment.StorageKey)
	}
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
	var existingAttachments []ReviewAttachment
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
		if len(input.Attachments) > 0 {
			attachments := make([]ReviewAttachment, 0, len(input.Attachments))
			for _, fileHeader := range input.Attachments {
				attachment, uploadErr := s.uploadReviewAttachment(ctx, review.ID, order.ID, item.ID, fileHeader)
				if uploadErr != nil {
					s.deleteReviewAttachments(ctx, attachments)
					return nil, uploadErr
				}
				attachments = append(attachments, *attachment)
			}
			metadata, metadataErr := buildReviewMetadata(nil, attachments)
			if metadataErr != nil {
				s.deleteReviewAttachments(ctx, attachments)
				return nil, metadataErr
			}
			review.Metadata = metadata
		}
		if createErr := s.DB.WithContext(ctx).Create(&review).Error; createErr != nil {
			if len(input.Attachments) > 0 {
				s.deleteReviewAttachments(ctx, parseReviewAttachmentMetadata(review.Metadata))
			}
			return nil, createErr
		}
		return &review, nil
	}

	existingAttachments = parseReviewAttachmentMetadata(review.Metadata)
	attachmentsToSave := existingAttachments
	if len(input.Attachments) > 0 {
		attachmentsToSave = make([]ReviewAttachment, 0, len(input.Attachments))
		for _, fileHeader := range input.Attachments {
			attachment, uploadErr := s.uploadReviewAttachment(ctx, review.ID, order.ID, item.ID, fileHeader)
			if uploadErr != nil {
				s.deleteReviewAttachments(ctx, attachmentsToSave)
				return nil, uploadErr
			}
			attachmentsToSave = append(attachmentsToSave, *attachment)
		}
	}
	metadata, metadataErr := buildReviewMetadata(review.Metadata, attachmentsToSave)
	if metadataErr != nil {
		if len(input.Attachments) > 0 {
			s.deleteReviewAttachments(ctx, attachmentsToSave)
		}
		return nil, metadataErr
	}

	updates := map[string]any{
		"rating":        input.Rating,
		"review_text":   input.ReviewText,
		"question_text": input.QuestionText,
		"updated_at":    now,
	}
	if metadata != nil {
		updates["metadata"] = metadata
	}
	if updateErr := s.DB.WithContext(ctx).
		Model(&reviewmodels.CustomerReview{}).
		Where("id = ?", review.ID).
		Updates(updates).Error; updateErr != nil {
		if len(input.Attachments) > 0 {
			s.deleteReviewAttachments(ctx, attachmentsToSave)
		}
		return nil, updateErr
	}
	if err := s.DB.WithContext(ctx).Where("id = ?", review.ID).First(&review).Error; err != nil {
		if len(input.Attachments) > 0 {
			s.deleteReviewAttachments(ctx, attachmentsToSave)
		}
		return nil, err
	}
	if len(input.Attachments) > 0 && len(existingAttachments) > 0 {
		s.deleteReviewAttachments(ctx, existingAttachments)
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
		Select("id, product_id, rating, review_text, question_text, seller_reply, metadata, created_at, updated_at").
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

type businessReviewRow struct {
	ID             string    `gorm:"column:id"`
	ProductID      string    `gorm:"column:product_id"`
	ProductTitle   string    `gorm:"column:product_title"`
	ProductVariant string    `gorm:"column:product_variant"`
	Rating         int       `gorm:"column:rating"`
	ReviewText     string    `gorm:"column:review_text"`
	QuestionText   string    `gorm:"column:question_text"`
	Metadata       []byte    `gorm:"column:metadata"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	CustomerName   string    `gorm:"column:customer_name"`
}

type ratingCountRow struct {
	Rating int   `gorm:"column:rating"`
	Count  int64 `gorm:"column:count"`
}

func businessReviewsBaseQuery(ctx context.Context, db *gorm.DB, businessID string) *gorm.DB {
	return db.WithContext(ctx).
		Table("customer_reviews cr").
		Joins("JOIN orders o ON o.id = cr.order_id").
		Joins("JOIN order_items oi ON oi.id = cr.order_item_id").
		Joins("LEFT JOIN customers c ON c.id = cr.customer_id").
		Where("o.business_id = ? AND cr.status = ? AND cr.is_visible = ?", strings.TrimSpace(businessID), "published", true)
}

func maskReviewerName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "pembeli"
	}
	runes := []rune(trimmed)
	if len(runes) == 1 {
		return string(runes[0]) + "***"
	}
	if len(runes) == 2 {
		return string(runes[0]) + "***"
	}
	return string(runes[0]) + "***" + string(runes[len(runes)-1])
}

func formatBusinessReviewLabel(createdAt time.Time) string {
	now := time.Now()
	local := createdAt.In(now.Location())
	current := now.In(now.Location())
	if local.Year() == current.Year() && local.YearDay() == current.YearDay() {
		return "Hari ini"
	}
	yesterday := current.AddDate(0, 0, -1)
	if local.Year() == yesterday.Year() && local.YearDay() == yesterday.YearDay() {
		return "Kemarin"
	}
	return local.Format("2 Jan 2006")
}

func metadataStringValues(value any) []string {
	switch typed := value.(type) {
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return nil
		}
		return []string{trimmed}
	case []string:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
				result = append(result, trimmed)
			}
		}
		return result
	case []any:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			if nested, ok := item.(string); ok {
				if trimmed := strings.TrimSpace(nested); trimmed != "" {
					result = append(result, trimmed)
				}
			}
		}
		return result
	default:
		return nil
	}
}

func metadataCollectionCount(value any) int {
	switch typed := value.(type) {
	case []any:
		return len(typed)
	case []string:
		return len(typed)
	case map[string]any:
		return len(typed)
	case string:
		if strings.TrimSpace(typed) != "" {
			return 1
		}
	case bool:
		if typed {
			return 1
		}
	case float64:
		return int(typed)
	case int:
		return typed
	case int64:
		return int(typed)
	}
	return 0
}

func normalizeBusinessReviewTopic(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "_", " ")
	normalized = strings.ReplaceAll(normalized, "-", " ")
	normalized = strings.Join(strings.Fields(normalized), " ")

	switch normalized {
	case "kualitas barang", "kualitas produk", "quality barang", "product quality":
		return "Kualitas Barang"
	case "pelayanan penjual", "pelayanan", "seller service", "customer service":
		return "Pelayanan Penjual"
	case "kemasan barang", "kemasan", "packing", "packaging":
		return "Kemasan Barang"
	case "kecepatan pengiriman", "pengiriman", "shipping speed", "delivery speed":
		return "Kecepatan Pengiriman"
	default:
		return ""
	}
}

func parseBusinessReviewMetadata(raw []byte) (bool, []string) {
	if len(strings.TrimSpace(string(raw))) == 0 {
		return false, nil
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return false, nil
	}

	hasMedia := false
	for _, key := range []string{"has_media", "hasMedia", "with_media", "withMedia", "has_photo", "hasPhoto", "has_video", "hasVideo"} {
		if value, ok := payload[key].(bool); ok && value {
			hasMedia = true
			break
		}
	}
	if !hasMedia {
		if count, ok := payload["media_count"].(float64); ok && count > 0 {
			hasMedia = true
		}
	}
	if !hasMedia {
		for _, key := range []string{"media", "attachments", "files", "images", "videos"} {
			if metadataCollectionCount(payload[key]) > 0 {
				hasMedia = true
				break
			}
		}
	}

	topicSeen := make(map[string]struct{})
	topics := make([]string, 0, 4)
	appendTopic := func(value string) {
		topic := normalizeBusinessReviewTopic(value)
		if topic == "" {
			return
		}
		if _, exists := topicSeen[topic]; exists {
			return
		}
		topicSeen[topic] = struct{}{}
		topics = append(topics, topic)
	}

	for _, key := range []string{"topics", "topic", "topic_label", "topic_labels", "tags"} {
		for _, value := range metadataStringValues(payload[key]) {
			appendTopic(value)
		}
	}

	return hasMedia, topics
}

func (s *ReviewService) GetBusinessReviewOverview(ctx context.Context, businessID string, limit int) (*PublicBusinessReviewOverview, error) {
	businessID = strings.TrimSpace(businessID)
	if businessID == "" {
		return nil, errors.New("business_id is required")
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	summaryQuery := businessReviewsBaseQuery(ctx, s.DB, businessID)
	listQuery := businessReviewsBaseQuery(ctx, s.DB, businessID)

	var total int64
	if err := summaryQuery.Count(&total).Error; err != nil {
		return nil, err
	}

	overview := &PublicBusinessReviewOverview{
		Summary: PublicBusinessReviewSummary{
			OutOf:            5,
			RatingCount:      total,
			ReviewCount:      total,
			SatisfiedPercent: 0,
			Breakdown:        make([]PublicBusinessReviewBreakdown, 0, 5),
		},
		Reviews: []PublicBusinessReview{},
	}

	if total == 0 {
		for star := 5; star >= 1; star-- {
			overview.Summary.Breakdown = append(overview.Summary.Breakdown, PublicBusinessReviewBreakdown{Star: star, Count: 0})
		}
		return overview, nil
	}

	var averageRating float64
	if err := summaryQuery.Select("COALESCE(AVG(cr.rating), 0)").Row().Scan(&averageRating); err != nil {
		return nil, err
	}
	overview.Summary.Score = averageRating

	var counts []ratingCountRow
	if err := summaryQuery.
		Select("cr.rating AS rating, COUNT(*) AS count").
		Group("cr.rating").
		Order("cr.rating DESC").
		Scan(&counts).Error; err != nil {
		return nil, err
	}

	countByRating := make(map[int]int64, len(counts))
	for _, row := range counts {
		countByRating[row.Rating] = row.Count
	}
	positiveCount := int64(0)
	for star := 5; star >= 1; star-- {
		count := countByRating[star]
		overview.Summary.Breakdown = append(overview.Summary.Breakdown, PublicBusinessReviewBreakdown{Star: star, Count: count})
		if star >= 4 {
			positiveCount += count
		}
	}
	overview.Summary.SatisfiedPercent = int(math.Round((float64(positiveCount) / float64(total)) * 100))

	var rows []businessReviewRow
	if err := listQuery.
		Select(`
			cr.id AS id,
			cr.product_id AS product_id,
			COALESCE(oi.product_name, '') AS product_title,
			COALESCE(oi.sku, '') AS product_variant,
			cr.rating AS rating,
			COALESCE(cr.review_text, '') AS review_text,
			COALESCE(cr.question_text, '') AS question_text,
			COALESCE(cr.metadata, '{}'::jsonb) AS metadata,
			cr.created_at AS created_at,
			COALESCE(c.name, '') AS customer_name
		`).
		Order("cr.created_at DESC").
		Limit(limit).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	views := make([]PublicBusinessReview, 0, len(rows))
	for _, row := range rows {
		content := strings.TrimSpace(row.ReviewText)
		if content == "" {
			content = strings.TrimSpace(row.QuestionText)
		}
		if content == "" {
			content = "Ulasan pembeli"
		}
		variant := strings.TrimSpace(row.ProductVariant)
		if variant == "" {
			variant = "Default"
		}
		hasMedia, topics := parseBusinessReviewMetadata(row.Metadata)
		views = append(views, PublicBusinessReview{
			ID:             row.ID,
			ProductID:      row.ProductID,
			ProductTitle:   strings.TrimSpace(row.ProductTitle),
			ProductVariant: variant,
			Rating:         row.Rating,
			CreatedAtLabel: formatBusinessReviewLabel(row.CreatedAt),
			CreatedAt:      row.CreatedAt.Format(time.RFC3339),
			UsernameMasked: maskReviewerName(row.CustomerName),
			Content:        content,
			HelpfulCount:   0,
			HasMedia:       hasMedia,
			Topics:         topics,
		})
	}
	overview.Reviews = views
	return overview, nil
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
