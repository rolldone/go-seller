package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"go_framework/internal/keydb"
	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	catalogmodels "go_framework/plugins/catalog/models"
	marketingmodels "go_framework/plugins/marketing/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Service provides CRUD operations for marketing resources.
type Service struct {
	DB *gorm.DB
}

// New creates a new marketing service.
func New(db *gorm.DB) *Service {
	return &Service{DB: db}
}

func normalizeCarouselLayoutType(layoutType string) string {
	switch strings.ToLower(strings.TrimSpace(layoutType)) {
	case "medium", "banner":
		return strings.ToLower(strings.TrimSpace(layoutType))
	default:
		return "large"
	}
}

func normalizeCarouselItems(items []marketingmodels.BusinessCarouselItem) (datatypes.JSON, error) {
	normalized := make([]marketingmodels.BusinessCarouselItem, 0, len(items))
	for index, item := range items {
		normalizedItem := marketingmodels.BusinessCarouselItem{
			ID:       strings.TrimSpace(item.ID),
			Title:    strings.TrimSpace(item.Title),
			Subtitle: strings.TrimSpace(item.Subtitle),
			Image:    strings.TrimSpace(item.Image),
			Href:     strings.TrimSpace(item.Href),
		}
		if normalizedItem.ID == "" {
			normalizedItem.ID = fmt.Sprintf("carousel-item-%d", index+1)
		}
		normalized = append(normalized, normalizedItem)
	}
	if normalized == nil {
		normalized = []marketingmodels.BusinessCarouselItem{}
	}
	raw, err := json.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(raw), nil
}

func normalizeCarouselSubtitle(subtitle string) *string {
	trimmed := strings.TrimSpace(subtitle)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeLocale(value string) string {
	locale := strings.ToLower(strings.TrimSpace(value))
	switch locale {
	case "id", "en":
		return locale
	default:
		return "id"
	}
}

// CreateBusinessCarousel inserts a new carousel row.
func (s *Service) CreateBusinessCarousel(ctx context.Context, businessID, slot, title, subtitle, layoutType string, isActive bool, sortOrder int, items []marketingmodels.BusinessCarouselItem) (*marketingmodels.BusinessCarousel, error) {
	if strings.TrimSpace(businessID) == "" {
		return nil, errors.New("businessId is required")
	}
	if strings.TrimSpace(slot) == "" {
		return nil, errors.New("slot is required")
	}

	normalizedItems, err := normalizeCarouselItems(items)
	if err != nil {
		return nil, err
	}

	row := &marketingmodels.BusinessCarousel{
		ID:         uuid.NewString(),
		BusinessID: businessID,
		Slot:       strings.TrimSpace(slot),
		Title:      strings.TrimSpace(title),
		Subtitle:   normalizeCarouselSubtitle(subtitle),
		LayoutType: normalizeCarouselLayoutType(layoutType),
		IsActive:   isActive,
		SortOrder:  sortOrder,
		Items:      normalizedItems,
	}

	if err := s.DB.WithContext(ctx).Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

// UpdateBusinessCarousel updates an existing carousel row.
func (s *Service) UpdateBusinessCarousel(ctx context.Context, id, businessID, slot, title, subtitle, layoutType string, isActive bool, sortOrder int, items []marketingmodels.BusinessCarouselItem) (*marketingmodels.BusinessCarousel, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("id is required")
	}
	if strings.TrimSpace(businessID) == "" {
		return nil, errors.New("businessId is required")
	}
	if strings.TrimSpace(slot) == "" {
		return nil, errors.New("slot is required")
	}

	var row marketingmodels.BusinessCarousel
	if err := s.DB.WithContext(ctx).Where("id = ?", id).First(&row).Error; err != nil {
		return nil, err
	}

	normalizedItems, err := normalizeCarouselItems(items)
	if err != nil {
		return nil, err
	}

	row.BusinessID = businessID
	row.Slot = strings.TrimSpace(slot)
	row.Title = strings.TrimSpace(title)
	row.Subtitle = normalizeCarouselSubtitle(subtitle)
	row.LayoutType = normalizeCarouselLayoutType(layoutType)
	row.IsActive = isActive
	row.SortOrder = sortOrder
	row.Items = normalizedItems

	if err := s.DB.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// ListBusinessCarousels returns carousels filtered by business and active state.
func (s *Service) ListBusinessCarousels(ctx context.Context, businessID string, onlyActive bool) ([]marketingmodels.BusinessCarousel, error) {
	q := s.DB.WithContext(ctx).Model(&marketingmodels.BusinessCarousel{})
	if strings.TrimSpace(businessID) != "" {
		q = q.Where("business_id = ?", strings.TrimSpace(businessID))
	}
	if onlyActive {
		q = q.Where("is_active = ?", true)
	}

	var rows []marketingmodels.BusinessCarousel
	if err := q.Order("sort_order asc, created_at asc").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// GetBusinessCarouselByID returns a single carousel by id.
func (s *Service) GetBusinessCarouselByID(ctx context.Context, id string) (*marketingmodels.BusinessCarousel, error) {
	var row marketingmodels.BusinessCarousel
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// DeleteBusinessCarouselByID deletes a carousel by id.
func (s *Service) DeleteBusinessCarouselByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).Delete(&marketingmodels.BusinessCarousel{})
	return res.RowsAffected, res.Error
}

// CreateSubscription inserts a new subscription or reactivates an existing one.
func (s *Service) CreateSubscription(ctx context.Context, businessID, productID, customerID, email string, consent bool, customerLocale string, metadata map[string]interface{}) (*marketingmodels.ProductSubscription, error) {
	if strings.TrimSpace(businessID) == "" {
		return nil, errors.New("businessId is required")
	}
	trimmedEmail := strings.TrimSpace(email)
	if trimmedEmail == "" {
		return nil, errors.New("email is required")
	}

	q := s.DB.WithContext(ctx).Model(&marketingmodels.ProductSubscription{}).
		Where("business_id = ? AND LOWER(email) = LOWER(?)", strings.TrimSpace(businessID), trimmedEmail)

	if strings.TrimSpace(productID) == "" {
		q = q.Where("product_id IS NULL")
	} else {
		q = q.Where("product_id = ?", strings.TrimSpace(productID))
	}

	var existing marketingmodels.ProductSubscription
	if err := q.First(&existing).Error; err == nil {
		now := time.Now().UTC()
		existing.UnsubscribedAt = nil
		existing.Consent = consent
		existing.SubscribedAt = now
		if metadata != nil {
			raw, err := json.Marshal(metadata)
			if err == nil {
				existing.Metadata = datatypes.JSON(raw)
			}
		}
		if strings.TrimSpace(customerID) != "" {
			v := strings.TrimSpace(customerID)
			existing.CustomerID = &v
		}
		if customerLocale != "" {
			if metadata == nil {
				metadata = map[string]interface{}{}
			}
			metadata["customer_locale"] = normalizeLocale(customerLocale)
			raw, err := json.Marshal(metadata)
			if err == nil {
				existing.Metadata = datatypes.JSON(raw)
			}
		}
		if err := s.DB.WithContext(ctx).Save(&existing).Error; err != nil {
			return nil, err
		}
		if err := s.queueSubscriptionConfirmation(ctx, &existing); err != nil {
			return nil, err
		}
		return &existing, nil
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		var pidPtr *string
		if strings.TrimSpace(productID) != "" {
			v := strings.TrimSpace(productID)
			pidPtr = &v
		}
		var cidPtr *string
		if strings.TrimSpace(customerID) != "" {
			v := strings.TrimSpace(customerID)
			cidPtr = &v
		}
		var meta datatypes.JSON
		if metadata != nil {
			raw, err := json.Marshal(metadata)
			if err != nil {
				return nil, err
			}
			meta = datatypes.JSON(raw)
		}
		row := &marketingmodels.ProductSubscription{
			ID:           uuid.NewString(),
			BusinessID:   strings.TrimSpace(businessID),
			ProductID:    pidPtr,
			CustomerID:   cidPtr,
			Email:        trimmedEmail,
			Consent:      consent,
			SubscribedAt: time.Now().UTC(),
			Metadata:     meta,
		}
		if customerLocale != "" {
			if metadata == nil {
				metadata = map[string]interface{}{}
			}
			metadata["customer_locale"] = normalizeLocale(customerLocale)
			raw, err := json.Marshal(metadata)
			if err != nil {
				return nil, err
			}
			row.Metadata = datatypes.JSON(raw)
		}
		if err := s.DB.WithContext(ctx).Create(row).Error; err != nil {
			return nil, err
		}
		if err := s.queueSubscriptionConfirmation(ctx, row); err != nil {
			return nil, err
		}

		return row, nil
	} else {
		return nil, err
	}
}

// queueSubscriptionConfirmation prepares a confirmation token, stores it in keydb and sends confirmation email.
func (s *Service) queueSubscriptionConfirmation(ctx context.Context, sub *marketingmodels.ProductSubscription) error {
	if sub == nil {
		return errors.New("subscription is nil")
	}

	// generate token
	token := uuid.NewString()

	payload := map[string]string{
		"subscription_id": sub.ID,
		"email":           sub.Email,
		"business_id":     sub.BusinessID,
	}
	if sub.ProductID != nil {
		payload["product_id"] = *sub.ProductID
	}
	raw, _ := json.Marshal(payload)

	ttlMin := 1440 // default 24 hours
	if v := strings.TrimSpace(os.Getenv("SUBSCRIPTION_CONFIRM_TTL_MINUTES")); v != "" {
		if parsed, err := fmt.Sscanf(v, "%d", &ttlMin); parsed == 0 || err != nil {
			// ignore parse error
		}
	}

	if keydb.Client == nil {
		// KeyDB not configured; still proceed without token storage (not ideal)
		fmt.Println("warning: keydb client is not configured; confirmation token not stored")
	} else {
		key := fmt.Sprintf("marketing:subscription:confirm:%s", token)
		err := keydb.Client.Set(ctx, key, string(raw), time.Duration(ttlMin)*time.Minute).Err()
		if err != nil {
			return err
		}
	}

	customerName, customerLocale := s.resolveSubscriptionCustomer(ctx, sub)
	if metaLocale := s.subscriptionLocaleFromMetadata(sub); metaLocale != "" {
		customerLocale = metaLocale
	}
	if customerLocale == "" {
		customerLocale = "id"
	}
	confirmURL := s.buildSubscriptionConfirmURL(token, customerLocale)
	businessName := s.resolveBusinessName(ctx, sub.BusinessID)
	productName := s.resolveProductName(ctx, sub.ProductID)
	if customerName == "" {
		customerName = sub.Email
	}
	if businessName == "" {
		businessName = "Toko"
	}

	pluginregistry.SendTemplateEventAsync(ctx, s.DB, "subscription_confirmation_customer", map[string]interface{}{
		"subscription_id": sub.ID,
		"email":           sub.Email,
		"customer_email":  sub.Email,
		"customer_name":   customerName,
		"customer_locale": customerLocale,
		"business_id":     sub.BusinessID,
		"business_name":   businessName,
		"product_id":      derefString(sub.ProductID),
		"product_name":    productName,
		"Name":            customerName,
		"ConfirmLink":     confirmURL,
		"ExpiryMinutes":   ttlMin,
		"app_name":        businessName,
	})
	return nil
}

func (s *Service) subscriptionLocaleFromMetadata(sub *marketingmodels.ProductSubscription) string {
	if sub == nil || len(sub.Metadata) == 0 {
		return "id"
	}
	var metadata map[string]interface{}
	if err := json.Unmarshal(sub.Metadata, &metadata); err != nil {
		return "id"
	}
	if value, ok := metadata["customer_locale"].(string); ok {
		return normalizeLocale(value)
	}
	return "id"
}

func (s *Service) buildSubscriptionConfirmURL(token string, locale string) string {
	base := strings.TrimRight(strings.TrimSpace(getEnvOrDefault("FRONT_URL", "")), "/")
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(getEnvOrDefault("PUBLIC_APP_URL", "")), "/")
	}
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(getEnvOrDefault("APP_URL", "")), "/")
	}
	pagePath := "/subscribe/confirm"
	if normalizeLocale(locale) == "en" {
		pagePath = "/en/subscribe/confirm"
	}
	return fmt.Sprintf("%s%s?token=%s", base, pagePath, token)
}

func (s *Service) resolveSubscriptionCustomer(ctx context.Context, sub *marketingmodels.ProductSubscription) (name string, locale string) {
	if sub == nil || sub.CustomerID == nil || strings.TrimSpace(*sub.CustomerID) == "" {
		return "", ""
	}
	var customer authmodels.Customer
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(*sub.CustomerID)).First(&customer).Error; err != nil {
		return "", ""
	}
	name = strings.TrimSpace(customer.Name)
	locale = normalizeLocale(customer.Locale)
	return name, locale
}

func (s *Service) resolveBusinessName(ctx context.Context, businessID string) string {
	businessID = strings.TrimSpace(businessID)
	if businessID == "" {
		return ""
	}
	var row struct{ Name string }
	if err := s.DB.WithContext(ctx).Raw("SELECT name FROM businesses WHERE id = ? LIMIT 1", businessID).Scan(&row).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(row.Name)
}

func (s *Service) resolveProductName(ctx context.Context, productID *string) string {
	if productID == nil || strings.TrimSpace(*productID) == "" {
		return ""
	}
	var product catalogmodels.Product
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(*productID)).First(&product).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(product.Name)
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func getEnvOrDefault(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

// SendSubscriptionConfirmation queues a confirmation email for an existing subscription by id.
func (s *Service) SendSubscriptionConfirmation(ctx context.Context, subscriptionID string) error {
	if strings.TrimSpace(subscriptionID) == "" {
		return errors.New("subscription id is required")
	}
	sub, err := s.GetSubscriptionByID(ctx, subscriptionID)
	if err != nil {
		return err
	}
	return s.queueSubscriptionConfirmation(ctx, sub)
}

// GetSubscriptionByID returns a subscription by id.
func (s *Service) GetSubscriptionByID(ctx context.Context, id string) (*marketingmodels.ProductSubscription, error) {
	var row marketingmodels.ProductSubscription
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// ListSubscriptions returns subscriptions filtered by business/product/email and status with pagination.
func (s *Service) ListSubscriptions(ctx context.Context, businessID, productID, email, status string, page, limit int) ([]marketingmodels.ProductSubscription, int64, error) {
	q := s.DB.WithContext(ctx).Model(&marketingmodels.ProductSubscription{})
	if strings.TrimSpace(businessID) != "" {
		q = q.Where("business_id = ?", strings.TrimSpace(businessID))
	}
	if strings.TrimSpace(productID) != "" {
		q = q.Where("product_id = ?", strings.TrimSpace(productID))
	}
	if strings.TrimSpace(email) != "" {
		q = q.Where("LOWER(email) = LOWER(?)", strings.TrimSpace(email))
	}
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active":
		q = q.Where("unsubscribed_at IS NULL")
	case "inactive", "unsubscribed":
		q = q.Where("unsubscribed_at IS NOT NULL")
	case "confirmed":
		q = q.Where("is_confirmed = ?", true)
	case "unconfirmed", "pending":
		q = q.Where("is_confirmed = ?", false)
	}

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	countQuery := q.Session(&gorm.Session{})
	var total int64
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []marketingmodels.ProductSubscription
	if err := q.Session(&gorm.Session{}).Order("subscribed_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// UnsubscribeByID marks a subscription as unsubscribed.
func (s *Service) UnsubscribeByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Model(&marketingmodels.ProductSubscription{}).Where("id = ?", strings.TrimSpace(id)).Updates(map[string]interface{}{"unsubscribed_at": time.Now().UTC(), "consent": false})
	return res.RowsAffected, res.Error
}

// UnsubscribeByEmail unsubscribes subscriptions matching business/product/email.
func (s *Service) UnsubscribeByEmail(ctx context.Context, businessID, productID, email string) (int64, error) {
	q := s.DB.WithContext(ctx).Model(&marketingmodels.ProductSubscription{}).Where("business_id = ? AND LOWER(email) = LOWER(?)", strings.TrimSpace(businessID), strings.TrimSpace(email))
	if strings.TrimSpace(productID) == "" {
		q = q.Where("product_id IS NULL")
	} else {
		q = q.Where("product_id = ?", strings.TrimSpace(productID))
	}
	res := q.Updates(map[string]interface{}{"unsubscribed_at": time.Now().UTC(), "consent": false})
	return res.RowsAffected, res.Error
}

// DeleteSubscriptionByID deletes a subscription record (admin).
func (s *Service) DeleteSubscriptionByID(ctx context.Context, id string) (int64, error) {
	res := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).Delete(&marketingmodels.ProductSubscription{})
	return res.RowsAffected, res.Error
}
