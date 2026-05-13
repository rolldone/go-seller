package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	authmodels "go_framework/plugins/auth/models"
	catalogmodels "go_framework/plugins/catalog/models"
	"go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"
	settingmodels "go_framework/plugins/setting/models"

	"go_framework/internal/uuid"

	"gorm.io/gorm"
)

type OrderService struct {
	DB *gorm.DB
}

func orderItemHasTaxColumns(tx *gorm.DB) bool {
	return tx.Migrator().HasColumn(&models.OrderItem{}, "tax_type") && tx.Migrator().HasColumn(&models.OrderItem{}, "tax_rate")
}

type ShippingQuoteDetails struct {
	ShippingAmount    float64
	CarrierName       string
	ServiceName       string
	EstimatedDelivery string
	Description       string
	Notes             string
}

type ShippingAddressSnapshot struct {
	AddressID     string
	Label         string
	ReceiverName  string
	PhoneNumber   string
	AddressLine1  string
	AddressLine2  *string
	Subdistrict   *string
	District      *string
	City          string
	Province      string
	PostalCode    string
	Country       string
	Notes         *string
	IsPrimary     bool
	AddressString string
}

type ExtraChargeInput struct {
	Name      string
	Amount    float64
	Notes     string
	SortOrder int
}

const orderExpiryHoursSettingKey = "order.expiry_hours"
const defaultOrderExpiryHours = 24
const orderRequireCustomerConfirmationSettingKey = "order.require_customer_confirmation"
const defaultOrderRequireCustomerConfirmation = false

func NewOrderService(db *gorm.DB) *OrderService {
	return &OrderService{DB: db}
}

func sumOrderExtraChargesTx(tx *gorm.DB, orderID string) (float64, error) {
	total := 0.0
	if err := tx.Model(&models.OrderExtraCharge{}).
		Where("order_id = ?", orderID).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&total).Error; err != nil {
		return 0, err
	}
	if total < 0 {
		total = 0
	}
	return total, nil
}

// Exported sentinel errors for handlers to map to appropriate HTTP responses.
var ErrOrderAlreadyPaid = errors.New("order is locked; cannot modify")
var ErrDuplicateCouponCategory = errors.New("cannot combine two coupons from the same category")
var ErrShippingAddressLocked = errors.New("shipping address cannot be changed after shipping quote is created")

const (
	FulfillmentTypeDelivery = "delivery"
	FulfillmentTypePickup   = "pickup"
)

func normalizeAppliedCouponCategory(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	switch trimmed {
	case "product_discount", "product", "discount", "product/cart", "cart", "cart_discount":
		return "product_discount"
	case "total_discount", "total", "order", "order_discount", "cart_total":
		return "total_discount"
	case "shipping", "shipping_discount", "ongkir", "free_shipping", "gratis_ongkir":
		return "shipping_discount"
	case "cashback":
		return "cashback"
	default:
		return "product_discount"
	}
}

func normalizeFulfillmentType(value string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	switch trimmed {
	case "", FulfillmentTypeDelivery:
		return FulfillmentTypeDelivery, nil
	case FulfillmentTypePickup:
		return FulfillmentTypePickup, nil
	default:
		return "", fmt.Errorf("invalid fulfillment type")
	}
}

func HasReadyShippingQuote(order *models.Order) bool {
	if order == nil || len(order.Metadata) == 0 || strings.EqualFold(strings.TrimSpace(string(order.Metadata)), "null") {
		return false
	}
	var root map[string]any
	if err := json.Unmarshal(order.Metadata, &root); err != nil {
		return false
	}
	var raw any
	if value, ok := root["shipping_quote"]; ok {
		raw = value
	} else if value, ok := root["shippingQuote"]; ok {
		raw = value
	} else {
		return false
	}
	quoteMap, ok := raw.(map[string]any)
	if !ok {
		return false
	}
	readyValue, ok := quoteMap["ready"]
	if !ok {
		return false
	}
	switch value := readyValue.(type) {
	case bool:
		return value
	case string:
		return strings.EqualFold(strings.TrimSpace(value), "true")
	default:
		return false
	}
}

func HasShippingAddress(order *models.Order) bool {
	if order == nil || len(order.Metadata) == 0 || strings.EqualFold(strings.TrimSpace(string(order.Metadata)), "null") {
		return false
	}
	var root map[string]any
	if err := json.Unmarshal(order.Metadata, &root); err != nil {
		return false
	}
	raw, ok := root["shipping_address"]
	if !ok {
		return false
	}
	addressMap, ok := raw.(map[string]any)
	if !ok {
		return false
	}
	for _, key := range []string{"address_id", "receiver_name", "address_line_1", "address_summary"} {
		if value, exists := addressMap[key]; exists && hasNonEmptyMetadataValue(value) {
			return true
		}
	}
	return false
}

func hasNonEmptyMetadataValue(value any) bool {
	text := strings.TrimSpace(fmt.Sprintf("%v", value))
	return text != "" && text != "<nil>"
}

func isOrderLocked(order models.Order) bool {
	status := strings.ToLower(strings.TrimSpace(order.Status))
	paymentStatus := strings.ToLower(strings.TrimSpace(order.PaymentStatus))
	if order.PaidAt != nil {
		return true
	}
	switch status {
	case "paid", "expired", "cancelled", "canceled":
		return true
	}
	switch paymentStatus {
	case "paid", "expired", "cancelled", "canceled":
		return true
	}
	return false
}

func isOrderExpiredOrCancelled(order models.Order) bool {
	status := strings.ToLower(strings.TrimSpace(order.Status))
	switch status {
	case "expired", "cancelled", "canceled":
		return true
	}
	return false
}

func parseOrderExpiryHours(raw []byte) int {
	if len(raw) == 0 || strings.EqualFold(strings.TrimSpace(string(raw)), "null") {
		return defaultOrderExpiryHours
	}
	var numeric float64
	if err := json.Unmarshal(raw, &numeric); err == nil {
		if numeric <= 0 {
			return 0
		}
		return int(numeric)
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		if v, convErr := strconv.Atoi(strings.TrimSpace(text)); convErr == nil {
			if v <= 0 {
				return 0
			}
			return v
		}
	}
	return defaultOrderExpiryHours
}

func parseBoolSettingValue(raw []byte, defaultValue bool) bool {
	if len(raw) == 0 || strings.EqualFold(strings.TrimSpace(string(raw)), "null") {
		return defaultValue
	}

	var booleanValue bool
	if err := json.Unmarshal(raw, &booleanValue); err == nil {
		return booleanValue
	}

	var textValue string
	if err := json.Unmarshal(raw, &textValue); err == nil {
		switch strings.ToLower(strings.TrimSpace(textValue)) {
		case "true", "1", "yes", "on":
			return true
		case "false", "0", "no", "off":
			return false
		}
	}

	return defaultValue
}

func (s *OrderService) getOrderExpiryHours(ctx context.Context) (int, error) {
	var setting settingmodels.Setting
	err := s.DB.WithContext(ctx).Where("scope = ? AND key = ?", "global", orderExpiryHoursSettingKey).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return defaultOrderExpiryHours, nil
		}
		return 0, err
	}
	hours := parseOrderExpiryHours(setting.Value)
	if hours < 0 {
		hours = 0
	}
	return hours, nil
}

func (s *OrderService) isCustomerConfirmationFeatureEnabled(ctx context.Context) (bool, error) {
	var setting settingmodels.Setting
	err := s.DB.WithContext(ctx).Where("scope = ? AND key = ?", "global", orderRequireCustomerConfirmationSettingKey).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return defaultOrderRequireCustomerConfirmation, nil
		}
		return false, err
	}
	return parseBoolSettingValue(setting.Value, defaultOrderRequireCustomerConfirmation), nil
}

func (s *OrderService) expireStalePendingOrders(ctx context.Context) error {
	hours, err := s.getOrderExpiryHours(ctx)
	if err != nil {
		return err
	}
	if hours <= 0 {
		return nil
	}
	now := time.Now()
	cutoff := now.Add(-time.Duration(hours) * time.Hour)
	return s.DB.WithContext(ctx).Model(&models.Order{}).
		Where("channel = ? AND status = ? AND payment_status IN ? AND COALESCE(placed_at, created_at) <= ?",
			"web", "pending", []string{PaymentStatusPending, PaymentStatusUnpaid}, cutoff).
		Updates(map[string]interface{}{
			"status":         OrderStatusCancelled,
			"payment_status": PaymentStatusExpired,
			"updated_at":     now,
		}).Error
}

func (s *OrderService) CheckoutCart(ctx context.Context, cartID string, currency string, couponCode *string, shippingAddress *ShippingAddressSnapshot) (*models.Order, error) {
	var cart models.Cart
	if err := s.DB.WithContext(ctx).Where("id = ?", cartID).First(&cart).Error; err != nil {
		return nil, err
	}
	var items []models.CartItem
	if err := s.DB.WithContext(ctx).Where("cart_id = ?", cartID).Find(&items).Error; err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, errors.New("cart is empty")
	}

	preview, err := NewCartService(s.DB).PreviewCartForCustomer(ctx, cart.CustomerID, cart.BusinessID, couponCode)
	if err != nil {
		return nil, err
	}
	if preview == nil || len(preview.Items) == 0 {
		return nil, errors.New("cart is empty")
	}

	previewByCartItemID := make(map[string]CartItemPreview, len(preview.Items))
	for _, pit := range preview.Items {
		if strings.TrimSpace(pit.ID) != "" {
			previewByCartItemID[strings.TrimSpace(pit.ID)] = pit
		}
	}

	var order *models.Order
	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		hasOrderItemTaxColumns := orderItemHasTaxColumns(tx)
		var metadataJSON []byte
		if shippingAddress != nil {
			metadata := map[string]any{
				"shipping_address": map[string]any{
					"address_id":      strings.TrimSpace(shippingAddress.AddressID),
					"label":           strings.TrimSpace(shippingAddress.Label),
					"receiver_name":   strings.TrimSpace(shippingAddress.ReceiverName),
					"phone_number":    strings.TrimSpace(shippingAddress.PhoneNumber),
					"address_line_1":  strings.TrimSpace(shippingAddress.AddressLine1),
					"address_line_2":  shippingAddress.AddressLine2,
					"subdistrict":     shippingAddress.Subdistrict,
					"district":        shippingAddress.District,
					"city":            strings.TrimSpace(shippingAddress.City),
					"province":        strings.TrimSpace(shippingAddress.Province),
					"postal_code":     strings.TrimSpace(shippingAddress.PostalCode),
					"country":         strings.TrimSpace(shippingAddress.Country),
					"notes":           shippingAddress.Notes,
					"is_primary":      shippingAddress.IsPrimary,
					"address_summary": strings.TrimSpace(shippingAddress.AddressString),
				},
			}
			buf, err := json.Marshal(metadata)
			if err != nil {
				return err
			}
			metadataJSON = buf
		}
		ord := models.Order{
			ID:              uuid.NewString(),
			OrderNumber:     "ORD-" + uuid.NewString(),
			CustomerID:      &cart.CustomerID,
			BusinessID:      cart.BusinessID,
			Channel:         "web",
			Status:          "pending",
			PaymentStatus:   PaymentStatusPending,
			Currency:        currency,
			Subtotal:        preview.Subtotal,
			DiscountAmount:  preview.DiscountAmount,
			TaxAmount:       preview.TaxAmount,
			ShippingAmount:  preview.ShippingAmount,
			FulfillmentType: FulfillmentTypeDelivery,
			GrandTotal:      preview.GrandTotal,
			Metadata:        metadataJSON,
			PlacedAt:        &now,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if err := tx.Create(&ord).Error; err != nil {
			return err
		}
		hasOrderItemProductTypeColumn := tx.Migrator().HasColumn(&models.OrderItem{}, "product_type")
		productTypeByID := map[string]string{}
		productIDs := make([]string, 0, len(items))
		for _, it := range items {
			if it.ProductID == nil || strings.TrimSpace(*it.ProductID) == "" {
				continue
			}
			productIDs = append(productIDs, strings.TrimSpace(*it.ProductID))
		}
		if len(productIDs) > 0 {
			var products []catalogmodels.Product
			if err := tx.Where("id IN ?", productIDs).Find(&products).Error; err == nil {
				for _, p := range products {
					pt := strings.TrimSpace(p.ProductType)
					if pt == "" {
						pt = "product"
					}
					productTypeByID[p.ID] = pt
				}
			}
		}
		for _, it := range items {
			pit := previewByCartItemID[it.ID]
			productID := it.ProductID
			if pit.ProductID != nil && strings.TrimSpace(*pit.ProductID) != "" {
				pid := strings.TrimSpace(*pit.ProductID)
				productID = &pid
			}
			productName := strings.TrimSpace(it.ProductName)
			if strings.TrimSpace(pit.ProductName) != "" {
				productName = strings.TrimSpace(pit.ProductName)
			}
			productType := "product"
			if productID != nil {
				pid := strings.TrimSpace(*productID)
				if pid != "" {
					if pt, ok := productTypeByID[pid]; ok && pt != "" {
						productType = pt
					}
				}
			}
			oi := models.OrderItem{
				ID:             uuid.NewString(),
				OrderID:        ord.ID,
				ProductID:      productID,
				ProductName:    productName,
				SKU:            it.SKU,
				ProductType:    productType,
				Qty:            it.Qty,
				UnitPrice:      it.UnitPrice,
				DiscountAmount: pit.DiscountAmount,
				TaxAmount:      pit.TaxAmount,
				TaxType:        pit.TaxType,
				TaxRate:        pit.TaxRate,
				LineTotal:      pit.PayableTotal,
				CreatedAt:      now,
				UpdatedAt:      now,
			}
			createTx := tx.Session(&gorm.Session{})
			if !hasOrderItemTaxColumns {
				createTx = createTx.Omit("TaxType", "TaxRate")
			}
			if !hasOrderItemProductTypeColumn {
				createTx = createTx.Omit("ProductType")
			}
			if err := createTx.Create(&oi).Error; err != nil {
				return err
			}
		}
		for _, ac := range preview.AppliedCoupons {
			couponCode := strings.TrimSpace(ac.Code)
			if couponCode == "" {
				continue
			}
			oc := models.OrderCoupon{
				ID:             uuid.NewString(),
				OrderID:        ord.ID,
				Code:           couponCode,
				Category:       normalizeAppliedCouponCategory(ac.Category),
				DiscountAmount: math.Max(0, ac.DiscountAmount),
				CreatedAt:      now,
				UpdatedAt:      now,
			}
			if err := tx.Create(&oc).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&models.Cart{}).Where("id = ?", cart.ID).Updates(map[string]interface{}{"status": "converted", "updated_at": now}).Error; err != nil {
			return err
		}
		order = &ord
		return nil
	})
	if err != nil {
		return nil, err
	}
	pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "order_created", order.ID)
	s.sendOrderCreatedMemberNotificationsAsync(context.Background(), order.ID)
	return order, nil
}

func (s *OrderService) CreateOrderAsAdmin(ctx context.Context, adminID string, userID *string, customerID *string, businessID *string, fulfillmentType string, items []models.OrderItem, currency string) (*models.Order, error) {
	var order *models.Order
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		subtotal := 0.0
		for _, it := range items {
			subtotal += float64(it.Qty) * it.UnitPrice
		}
		normalizedFulfillmentType, err := normalizeFulfillmentType(fulfillmentType)
		if err != nil {
			return err
		}
		ord := models.Order{
			ID:              uuid.NewString(),
			OrderNumber:     "POS-" + uuid.NewString(),
			UserID:          userID,
			CustomerID:      customerID,
			BusinessID:      businessID,
			Channel:         "pos",
			Status:          "pending",
			PaymentStatus:   PaymentStatusPending,
			Currency:        currency,
			Subtotal:        subtotal,
			DiscountAmount:  0,
			TaxAmount:       0,
			ShippingAmount:  0,
			FulfillmentType: normalizedFulfillmentType,
			GrandTotal:      subtotal,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if trimmedAdminID := strings.TrimSpace(adminID); trimmedAdminID != "" {
			ord.CreatedByAdminID = &trimmedAdminID
		}
		if err := tx.Create(&ord).Error; err != nil {
			return err
		}
		for _, it := range items {
			it.ID = uuid.NewString()
			it.OrderID = ord.ID
			it.CreatedAt = now
			it.UpdatedAt = now
			if err := tx.Create(&it).Error; err != nil {
				return err
			}
		}
		if err := s.recalculateOrderTotalsTx(tx, ord.ID, now); err != nil {
			return err
		}
		if err := tx.Where("id = ?", ord.ID).First(&ord).Error; err != nil {
			return err
		}
		order = &ord
		return nil
	})
	if err != nil {
		return nil, err
	}
	pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "order_created", order.ID)
	s.sendOrderCreatedMemberNotificationsAsync(context.Background(), order.ID)
	return order, nil
}

// CreateDraftOrderAsAdmin creates a draft POS order with no items yet.
func (s *OrderService) CreateDraftOrderAsAdmin(ctx context.Context, adminID string, userID *string, customerID *string, businessID *string, fulfillmentType string, currency string) (*models.Order, error) {
	now := time.Now()
	normalizedFulfillmentType, err := normalizeFulfillmentType(fulfillmentType)
	if err != nil {
		return nil, err
	}
	ord := &models.Order{
		ID:              uuid.NewString(),
		OrderNumber:     "POS-" + uuid.NewString(),
		UserID:          userID,
		CustomerID:      customerID,
		BusinessID:      businessID,
		Channel:         "pos",
		Status:          "draft",
		PaymentStatus:   PaymentStatusPending,
		Currency:        currency,
		Subtotal:        0,
		DiscountAmount:  0,
		TaxAmount:       0,
		ShippingAmount:  0,
		FulfillmentType: normalizedFulfillmentType,
		GrandTotal:      0,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if trimmedAdminID := strings.TrimSpace(adminID); trimmedAdminID != "" {
		ord.CreatedByAdminID = &trimmedAdminID
	}
	if err := s.DB.WithContext(ctx).Create(ord).Error; err != nil {
		return nil, err
	}
	return ord, nil
}

// AddItemToOrder appends an item to an order and recalculates totals.
func (s *OrderService) AddItemToOrder(ctx context.Context, orderID string, item models.OrderItem) (*models.OrderItem, error) {
	var created *models.OrderItem
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		// prevent modifying orders that are already paid or locked
		if isOrderLocked(order) {
			return ErrOrderAlreadyPaid
		}
		now := time.Now()
		hasOrderItemProductTypeColumn := tx.Migrator().HasColumn(&models.OrderItem{}, "product_type")
		item.ID = uuid.NewString()
		item.OrderID = orderID
		if strings.TrimSpace(item.ProductType) == "" {
			item.ProductType = "product"
		}
		if item.ProductID != nil && strings.TrimSpace(*item.ProductID) != "" {
			var p catalogmodels.Product
			if err := tx.Select("id", "product_type").Where("id = ?", strings.TrimSpace(*item.ProductID)).First(&p).Error; err == nil {
				if strings.TrimSpace(p.ProductType) != "" {
					item.ProductType = strings.TrimSpace(p.ProductType)
				}
			}
		}
		item.DiscountAmount = 0
		item.LineTotal = float64(item.Qty)*item.UnitPrice - item.DiscountAmount + item.TaxAmount
		item.CreatedAt = now
		item.UpdatedAt = now
		createTx := tx.Session(&gorm.Session{})
		if !hasOrderItemProductTypeColumn {
			createTx = createTx.Omit("ProductType")
		}
		if err := createTx.Create(&item).Error; err != nil {
			return err
		}
		if err := s.recalculateOrderTotalsTx(tx, orderID, now); err != nil {
			return err
		}
		created = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

// RemoveOrderItem deletes an order item and recalculates totals.
func (s *OrderService) RemoveOrderItem(ctx context.Context, orderID string, itemID string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		// prevent modifying orders that are already paid or locked
		if isOrderLocked(order) {
			return ErrOrderAlreadyPaid
		}
		now := time.Now()
		if err := tx.Where("id = ? AND order_id = ?", itemID, orderID).Delete(&models.OrderItem{}).Error; err != nil {
			return err
		}
		return s.recalculateOrderTotalsTx(tx, orderID, now)
	})
}

// ApplyDiscountToOrderItem assigns a product discount to an order item.
func (s *OrderService) ApplyDiscountToOrderItem(ctx context.Context, orderID, itemID, discountID string) (*models.Order, error) {
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if isOrderLocked(order) {
			return ErrOrderAlreadyPaid
		}

		var item models.OrderItem
		if err := tx.Where("id = ? AND order_id = ?", itemID, orderID).First(&item).Error; err != nil {
			return err
		}
		if item.ProductID == nil || strings.TrimSpace(*item.ProductID) == "" {
			return errors.New("item product is required for discount")
		}

		var discount catalogmodels.Discount
		if err := tx.Where("id = ?", discountID).First(&discount).Error; err != nil {
			return errors.New("discount not found")
		}

		now := time.Now()
		if !discount.IsActive {
			return errors.New("discount is not active")
		}
		if now.Before(discount.StartAt) {
			return errors.New("discount is not yet valid")
		}
		if discount.EndAt != nil && now.After(*discount.EndAt) {
			return errors.New("discount has expired")
		}
		if discount.MinOrderAmount != nil && order.Subtotal < *discount.MinOrderAmount {
			return errors.New("order amount does not meet minimum for this discount")
		}

		var relationCount int64
		if err := tx.Table("discount_products").Where("discount_id = ?", discountID).Count(&relationCount).Error; err != nil {
			return err
		}
		if relationCount > 0 {
			var matched int64
			if err := tx.Table("discount_products").
				Where("discount_id = ? AND product_id = ?", discountID, *item.ProductID).
				Count(&matched).Error; err != nil {
				return err
			}
			if matched == 0 {
				return errors.New("discount is not applicable to this product")
			}
		}

		if discount.ProductMinQty != nil && item.Qty < *discount.ProductMinQty {
			return errors.New("item quantity does not meet minimum quantity for discount")
		}

		effectiveQty := float64(item.Qty)
		if discount.ProductQtyLimit != nil && *discount.ProductQtyLimit > 0 && effectiveQty > float64(*discount.ProductQtyLimit) {
			effectiveQty = float64(*discount.ProductQtyLimit)
		}
		baseAmount := effectiveQty * item.UnitPrice
		if baseAmount <= 0 {
			return errors.New("invalid item amount for discount")
		}

		discountAmount := 0.0
		switch discount.DiscountType {
		case "percentage":
			discountAmount = baseAmount * discount.DiscountValue / 100
		default:
			discountAmount = discount.DiscountValue
		}
		if discount.MaxDiscountAmount != nil && discountAmount > *discount.MaxDiscountAmount {
			discountAmount = *discount.MaxDiscountAmount
		}
		discountAmount = math.Min(discountAmount, baseAmount)
		if discountAmount < 0 {
			discountAmount = 0
		}

		if err := tx.Where("order_item_id = ?", itemID).Delete(&models.OrderDiscount{}).Error; err != nil {
			return err
		}

		od := &models.OrderDiscount{
			ID:             uuid.NewString(),
			OrderID:        orderID,
			OrderItemID:    itemID,
			DiscountID:     discount.ID,
			DiscountName:   discount.Name,
			DiscountType:   discount.DiscountType,
			DiscountValue:  discount.DiscountValue,
			Priority:       discount.Priority,
			DiscountAmount: discountAmount,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := tx.Create(od).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.OrderItem{}).Where("id = ?", itemID).Updates(map[string]interface{}{
			"discount_amount": discountAmount,
			"updated_at":      now,
		}).Error; err != nil {
			return err
		}

		return s.recalculateOrderTotalsTx(tx, orderID, now)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

// RemoveDiscountFromOrderItem removes a selected product discount from an item.
func (s *OrderService) RemoveDiscountFromOrderItem(ctx context.Context, orderID, itemID string) (*models.Order, error) {
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if isOrderLocked(order) {
			return ErrOrderAlreadyPaid
		}

		now := time.Now()
		if err := tx.Where("order_item_id = ?", itemID).Delete(&models.OrderDiscount{}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.OrderItem{}).Where("id = ? AND order_id = ?", itemID, orderID).Updates(map[string]interface{}{
			"discount_amount": 0,
			"updated_at":      now,
		}).Error; err != nil {
			return err
		}
		return s.recalculateOrderTotalsTx(tx, orderID, now)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

// FinalizeOrder marks a draft order as pending.
func (s *OrderService) FinalizeOrder(ctx context.Context, orderID string) (*models.Order, error) {
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		// if already paid, do not change status
		if order.PaymentStatus == "paid" || order.PaidAt != nil {
			return ErrOrderAlreadyPaid
		}
		if err := s.recalculateOrderTotalsTx(tx, orderID, now); err != nil {
			return err
		}
		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]interface{}{
			"status":     "pending",
			"updated_at": now,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

// UpdateOrderStatus sets the order's status to the provided value.
func (s *OrderService) UpdateOrderStatus(ctx context.Context, orderID string, status string) (*models.Order, error) {
	normalizedStatus := normalizeOrderStatus(status)
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		// allow updating status regardless of payment state; caller should validate transitions
		if err := tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]interface{}{
			"status":     normalizedStatus,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}
		order.Status = normalizedStatus
		if normalizedStatus == "completed" {
			if err := s.createPendingSettlementTx(tx, &order, now, "admin_status_completed"); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	updated, err := s.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	switch normalizedStatus {
	case "completed":
		pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "completed_order_customer", orderID)
	case "cancelled", "canceled":
		pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "cancelled_order_admin", orderID)
	}
	return updated, nil
}

func (s *OrderService) UpdateShippingQuote(ctx context.Context, orderID string, details ShippingQuoteDetails) (*models.Order, error) {
	if details.ShippingAmount < 0 {
		return nil, errors.New("shipping_amount must be >= 0")
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}

		status := strings.ToLower(strings.TrimSpace(order.Status))
		paymentStatus := strings.ToLower(strings.TrimSpace(order.PaymentStatus))
		if isOrderExpiredOrCancelled(order) || paymentStatus == "expired" || paymentStatus == "cancelled" || paymentStatus == "canceled" {
			return ErrOrderAlreadyPaid
		}
		isPaidOrder := order.PaidAt != nil || paymentStatus == "paid" || status == "paid" || status == "confirmed" || status == "completed"
		if isPaidOrder {
			if math.Abs(details.ShippingAmount-order.ShippingAmount) > 0.000001 {
				return errors.New("shipping_amount cannot be changed after payment")
			}
		}

		metadata := map[string]any{}
		if len(order.Metadata) > 0 && !strings.EqualFold(strings.TrimSpace(string(order.Metadata)), "null") {
			if err := json.Unmarshal(order.Metadata, &metadata); err != nil {
				metadata = map[string]any{}
			}
		}
		metadata["shipping_quote"] = map[string]any{
			"ready":              true,
			"shipping_amount":    details.ShippingAmount,
			"carrier_name":       strings.TrimSpace(details.CarrierName),
			"service_name":       strings.TrimSpace(details.ServiceName),
			"estimated_delivery": strings.TrimSpace(details.EstimatedDelivery),
			"description":        strings.TrimSpace(details.Description),
			"notes":              strings.TrimSpace(details.Notes),
			"updated_at":         now.Format(time.RFC3339),
		}
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		updates := map[string]interface{}{
			"metadata":   metadataJSON,
			"updated_at": now,
		}
		if !isPaidOrder {
			extraChargeTotal, err := sumOrderExtraChargesTx(tx, orderID)
			if err != nil {
				return err
			}
			grand := order.Subtotal - order.DiscountAmount + order.TaxAmount + details.ShippingAmount + extraChargeTotal
			if grand < 0 {
				grand = 0
			}
			updates["shipping_amount"] = details.ShippingAmount
			updates["grand_total"] = grand
			updates["status"] = OrderStatusQuoteReady
			updates["payment_status"] = PaymentStatusPending
		}
		if err := tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(updates).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

func (s *OrderService) UpdateShippingAddress(ctx context.Context, orderID string, shippingAddress ShippingAddressSnapshot) (*models.Order, error) {
	if strings.TrimSpace(shippingAddress.AddressID) == "" {
		return nil, errors.New("address_id is required")
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}

		if isOrderLocked(order) {
			return ErrOrderAlreadyPaid
		}
		if HasReadyShippingQuote(&order) {
			return ErrShippingAddressLocked
		}

		metadata := map[string]any{}
		if len(order.Metadata) > 0 && !strings.EqualFold(strings.TrimSpace(string(order.Metadata)), "null") {
			if err := json.Unmarshal(order.Metadata, &metadata); err != nil {
				metadata = map[string]any{}
			}
		}
		metadata["shipping_address"] = map[string]any{
			"address_id":      strings.TrimSpace(shippingAddress.AddressID),
			"label":           strings.TrimSpace(shippingAddress.Label),
			"receiver_name":   strings.TrimSpace(shippingAddress.ReceiverName),
			"phone_number":    strings.TrimSpace(shippingAddress.PhoneNumber),
			"address_line_1":  strings.TrimSpace(shippingAddress.AddressLine1),
			"address_line_2":  shippingAddress.AddressLine2,
			"subdistrict":     shippingAddress.Subdistrict,
			"district":        shippingAddress.District,
			"city":            strings.TrimSpace(shippingAddress.City),
			"province":        strings.TrimSpace(shippingAddress.Province),
			"postal_code":     strings.TrimSpace(shippingAddress.PostalCode),
			"country":         strings.TrimSpace(shippingAddress.Country),
			"notes":           shippingAddress.Notes,
			"is_primary":      shippingAddress.IsPrimary,
			"address_summary": strings.TrimSpace(shippingAddress.AddressString),
		}
		delete(metadata, "shipping_quote")
		delete(metadata, "shippingQuote")

		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		extraChargeTotal, err := sumOrderExtraChargesTx(tx, orderID)
		if err != nil {
			return err
		}

		grand := order.Subtotal - order.DiscountAmount + order.TaxAmount + extraChargeTotal
		if grand < 0 {
			grand = 0
		}

		updates := map[string]any{
			"metadata":        metadataJSON,
			"shipping_amount": 0,
			"grand_total":     grand,
			"status":          OrderStatusAwaitingQuote,
			"payment_status":  PaymentStatusPending,
			"updated_at":      now,
		}
		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(updates).Error
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

func (s *OrderService) recalculateOrderTotalsTx(tx *gorm.DB, orderID string, now time.Time) error {
	var items []models.OrderItem
	if err := tx.Where("order_id = ?", orderID).Find(&items).Error; err != nil {
		return err
	}
	hasOrderItemTaxColumns := orderItemHasTaxColumns(tx)
	subtotal := 0.0
	// collect product ids
	prodIDs := make([]string, 0, len(items))
	for _, it := range items {
		subtotal += float64(it.Qty) * it.UnitPrice
		if it.ProductID != nil && *it.ProductID != "" {
			prodIDs = append(prodIDs, *it.ProductID)
		}
	}

	// load products in bulk
	prodMap := map[string]catalogmodels.Product{}
	if len(prodIDs) > 0 {
		var prods []catalogmodels.Product
		if err := tx.Where("id IN (?)", prodIDs).Find(&prods).Error; err == nil {
			for _, p := range prods {
				prodMap[p.ID] = p
			}
		}
	}

	// attempt to read global tax default from settings table (key: tax.default)
	globalTaxType := "exclude"
	globalTaxRate := 0.0
	var sset settingmodels.Setting
	if err := tx.Where("scope = ? AND key = ?", "global", "tax.default").First(&sset).Error; err == nil {
		var payload struct {
			TaxType string  `json:"tax_type"`
			TaxRate float64 `json:"tax_rate"`
		}
		if err := json.Unmarshal(sset.Value, &payload); err == nil {
			if payload.TaxType != "" {
				globalTaxType = payload.TaxType
			}
			globalTaxRate = payload.TaxRate
		}
	}

	// calculate per-item tax and update items
	totalDiscount := 0.0
	totalTax := 0.0
	totalLineTotals := 0.0
	for _, it := range items {
		lineBase := float64(it.Qty) * it.UnitPrice
		lineDiscount := it.DiscountAmount
		lineNet := lineBase - lineDiscount

		// determine tax source
		taxType := globalTaxType
		taxRate := globalTaxRate
		pid := ""
		if it.ProductID != nil {
			pid = *it.ProductID
		}
		if p, ok := prodMap[pid]; ok {
			if p.CustomTax {
				if p.TaxType != "" {
					taxType = p.TaxType
				}
				// normalize stored tax rate: support both decimals (0.11) and percentages (11)
				taxRate = p.TaxRate
			}
		}
		// If taxRate was stored as a percentage (e.g., 10 for 10%), normalize to decimal
		if taxRate > 1 {
			taxRate = taxRate / 100
		}

		var lineTax float64
		if taxRate > 0 {
			if taxType == "include" {
				// tax included in price: extract portion from the gross price (lineNet already includes tax)
				lineTax = lineNet - (lineNet / (1 + taxRate))
				// lineTotal remains the gross amount (already includes tax)
				lineTotal := lineNet
				// persist item tax and line total
				updates := map[string]interface{}{"tax_amount": lineTax, "line_total": lineTotal, "updated_at": now}
				if hasOrderItemTaxColumns {
					updates["tax_type"] = taxType
					updates["tax_rate"] = taxRate
				}
				if err := tx.Model(&models.OrderItem{}).Where("id = ?", it.ID).Updates(updates).Error; err != nil {
					return err
				}
				totalLineTotals += lineTotal
				totalDiscount += lineDiscount
				totalTax += lineTax
				continue
			} else {
				// tax excluded: add on top
				lineTax = lineNet * taxRate
			}
		} else {
			lineTax = 0
		}

		lineTotal := lineNet + lineTax

		// persist item tax and line total
		updates := map[string]interface{}{"tax_amount": lineTax, "line_total": lineTotal, "updated_at": now}
		if hasOrderItemTaxColumns {
			updates["tax_type"] = taxType
			updates["tax_rate"] = taxRate
		}
		if err := tx.Model(&models.OrderItem{}).Where("id = ?", it.ID).Updates(updates).Error; err != nil {
			return err
		}

		totalLineTotals += lineTotal
		totalDiscount += lineDiscount
		totalTax += lineTax
	}

	// include coupon-based discount in order totals
	couponTotal := 0.0
	var coupons []models.OrderCoupon
	if err := tx.Where("order_id = ?", orderID).Find(&coupons).Error; err != nil {
		return err
	}
	for _, c := range coupons {
		couponTotal += c.DiscountAmount
	}

	// compute grand total as sum of line totals + shipping - coupon discounts
	var ord models.Order
	if err := tx.Where("id = ?", orderID).First(&ord).Error; err != nil {
		return err
	}
	shipping := ord.ShippingAmount
	extraChargeTotal, err := sumOrderExtraChargesTx(tx, orderID)
	if err != nil {
		return err
	}

	grand := totalLineTotals + shipping + extraChargeTotal - couponTotal
	if grand < 0 {
		grand = 0
	}
	combinedDiscount := totalDiscount + couponTotal

	return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]interface{}{"subtotal": subtotal, "grand_total": grand, "discount_amount": combinedDiscount, "tax_amount": totalTax, "shipping_amount": shipping, "updated_at": now}).Error
}

func (s *OrderService) GetOrderByID(ctx context.Context, id string) (*models.Order, error) {
	trimmedID := strings.TrimSpace(id)
	if trimmedID == "" {
		return nil, gorm.ErrRecordNotFound
	}
	if err := s.expireStalePendingOrders(ctx); err != nil {
		return nil, err
	}
	var o models.Order
	if err := s.DB.WithContext(ctx).
		Preload("OrderItems").
		Preload("Payments").
		Preload("OrderCoupons").
		Preload("ExtraCharges", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, created_at ASC") }).
		Preload("Shipments", func(db *gorm.DB) *gorm.DB { return db.Order("created_at ASC") }).
		Preload("Shipments.Items").
		Preload("Customer").
		Where("id = ?", trimmedID).
		First(&o).Error; err != nil {
		return nil, err
	}
	// populate discount names for order items from order_discounts
	var ods []models.OrderDiscount
	if err := s.DB.WithContext(ctx).Where("order_id = ?", trimmedID).Find(&ods).Error; err == nil {
		odMap := make(map[string]string)
		for _, od := range ods {
			if od.OrderItemID != "" {
				odMap[od.OrderItemID] = od.DiscountName
			}
		}
		for i := range o.OrderItems {
			if name, ok := odMap[o.OrderItems[i].ID]; ok {
				o.OrderItems[i].DiscountName = name
			}
		}
	}
	return &o, nil
}

func (s *OrderService) GetOrderByIDForCustomer(ctx context.Context, id string, customerID string) (*models.Order, error) {
	trimmedOrderID := strings.TrimSpace(id)
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedOrderID == "" || trimmedCustomerID == "" {
		return nil, gorm.ErrRecordNotFound
	}

	order, err := s.GetOrderByID(ctx, trimmedOrderID)
	if err != nil {
		return nil, err
	}
	if order.CustomerID == nil || strings.TrimSpace(*order.CustomerID) == "" {
		return nil, gorm.ErrRecordNotFound
	}
	if strings.TrimSpace(*order.CustomerID) != trimmedCustomerID {
		return nil, gorm.ErrRecordNotFound
	}
	return order, nil
}

// UpdateOrderCustomerAndFulfillment updates draft POS order fields in one transaction.
func (s *OrderService) UpdateOrderCustomerAndFulfillment(ctx context.Context, orderID string, customerID *string, fulfillmentType *string) (*models.Order, error) {
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var ord models.Order
		if err := tx.Where("id = ?", orderID).First(&ord).Error; err != nil {
			return err
		}
		if isOrderLocked(ord) {
			return ErrOrderAlreadyPaid
		}

		updates := map[string]interface{}{
			"customer_id": customerID,
			"updated_at":  now,
		}

		needsRecalc := false
		if fulfillmentType != nil {
			normalizedFulfillmentType, err := normalizeFulfillmentType(*fulfillmentType)
			if err != nil {
				return err
			}
			updates["fulfillment_type"] = normalizedFulfillmentType
			needsRecalc = true
			if normalizedFulfillmentType == FulfillmentTypePickup {
				updates["shipping_amount"] = 0
				metadata := map[string]any{}
				if len(ord.Metadata) > 0 && !strings.EqualFold(strings.TrimSpace(string(ord.Metadata)), "null") {
					if err := json.Unmarshal(ord.Metadata, &metadata); err != nil {
						metadata = map[string]any{}
					}
				}
				delete(metadata, "shipping_address")
				delete(metadata, "shippingAddress")
				delete(metadata, "shipping_quote")
				delete(metadata, "shippingQuote")
				metadataJSON, err := json.Marshal(metadata)
				if err != nil {
					return err
				}
				updates["metadata"] = metadataJSON
			}
		}

		if err := tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(updates).Error; err != nil {
			return err
		}
		if needsRecalc {
			if err := s.recalculateOrderTotalsTx(tx, orderID, now); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

func (s *OrderService) ReplaceOrderExtraCharges(ctx context.Context, orderID string, adminID string, charges []ExtraChargeInput) (*models.Order, error) {
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var ord models.Order
		if err := tx.Where("id = ?", orderID).First(&ord).Error; err != nil {
			return err
		}
		if isOrderLocked(ord) {
			return ErrOrderAlreadyPaid
		}

		if err := tx.Where("order_id = ?", orderID).Delete(&models.OrderExtraCharge{}).Error; err != nil {
			return err
		}

		trimmedAdminID := strings.TrimSpace(adminID)
		for index, chargeInput := range charges {
			name := strings.TrimSpace(chargeInput.Name)
			if name == "" {
				return errors.New("extra charge name is required")
			}
			if chargeInput.Amount < 0 {
				return errors.New("extra charge amount must be >= 0")
			}

			sortOrder := chargeInput.SortOrder
			if sortOrder == 0 {
				sortOrder = index + 1
			}

			extraCharge := models.OrderExtraCharge{
				ID:        uuid.NewString(),
				OrderID:   orderID,
				Name:      name,
				Amount:    chargeInput.Amount,
				Notes:     strings.TrimSpace(chargeInput.Notes),
				SortOrder: sortOrder,
				CreatedAt: now,
				UpdatedAt: now,
			}
			if trimmedAdminID != "" {
				extraCharge.CreatedByAdminID = &trimmedAdminID
			}

			if err := tx.Create(&extraCharge).Error; err != nil {
				return err
			}
		}

		return s.recalculateOrderTotalsTx(tx, orderID, now)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

// ApplyCouponToOrder validates and adds a coupon to the order using the order_coupons table.
func (s *OrderService) ApplyCouponToOrder(ctx context.Context, orderID, couponCode string) (*models.Order, error) {
	var ord models.Order
	if err := s.DB.WithContext(ctx).Where("id = ?", orderID).First(&ord).Error; err != nil {
		return nil, err
	}
	if isOrderLocked(ord) {
		return nil, ErrOrderAlreadyPaid
	}

	var coupon catalogmodels.Coupon
	if err := s.DB.WithContext(ctx).Where("UPPER(code) = UPPER(?)", couponCode).First(&coupon).Error; err != nil {
		return nil, errors.New("coupon not found")
	}

	now := time.Now()
	if !coupon.IsActive {
		return nil, errors.New("coupon is not active")
	}
	if now.Before(coupon.StartAt) {
		return nil, errors.New("coupon is not yet valid")
	}
	if coupon.EndAt != nil && now.After(*coupon.EndAt) {
		return nil, errors.New("coupon has expired")
	}
	if coupon.MinOrderAmount != nil && ord.Subtotal < *coupon.MinOrderAmount {
		return nil, errors.New("order amount does not meet minimum for this coupon")
	}

	// load existing coupons for order
	var existing []models.OrderCoupon
	if err := s.DB.WithContext(ctx).Where("order_id = ?", orderID).Find(&existing).Error; err != nil {
		return nil, err
	}
	category := normalizeAppliedCouponCategory(coupon.Category)
	for _, ec := range existing {
		if ec.Code == coupon.Code {
			return nil, errors.New("coupon already applied")
		}
		if normalizeAppliedCouponCategory(ec.Category) == category {
			return nil, ErrDuplicateCouponCategory
		}
	}

	// compute discount for this coupon
	var couponDiscount float64
	if category == "cashback" {
		couponDiscount = 0
	} else if category == "shipping_discount" {
		baseAmount := ord.ShippingAmount
		switch coupon.DiscountType {
		case "percentage":
			couponDiscount = baseAmount * coupon.DiscountValue / 100
			if coupon.MaxDiscountAmount != nil && couponDiscount > *coupon.MaxDiscountAmount {
				couponDiscount = *coupon.MaxDiscountAmount
			}
		default:
			couponDiscount = coupon.DiscountValue
		}
		if couponDiscount > baseAmount {
			couponDiscount = baseAmount
		}
	} else if category == "total_discount" {
		baseAmount := ord.Subtotal
		switch coupon.DiscountType {
		case "percentage":
			couponDiscount = baseAmount * coupon.DiscountValue / 100
			if coupon.MaxDiscountAmount != nil && couponDiscount > *coupon.MaxDiscountAmount {
				couponDiscount = *coupon.MaxDiscountAmount
			}
		default:
			couponDiscount = coupon.DiscountValue
		}
		if couponDiscount > baseAmount {
			couponDiscount = baseAmount
		}
	} else { // product_discount
		// determine product-targeted base amount
		var prodIDs []string
		if err := s.DB.WithContext(ctx).
			Table("coupon_products").
			Select("product_id").
			Where("coupon_id = ?", coupon.ID).
			Order("product_id").
			Pluck("product_id", &prodIDs).Error; err != nil {
			return nil, err
		}
		var baseAmount float64
		if len(prodIDs) == 0 {
			baseAmount = ord.Subtotal
		} else {
			var items []models.OrderItem
			if err := s.DB.WithContext(ctx).Where("order_id = ? AND product_id IN ?", orderID, prodIDs).Find(&items).Error; err != nil {
				return nil, err
			}
			for _, it := range items {
				baseAmount += it.LineTotal
			}
		}
		switch coupon.DiscountType {
		case "percentage":
			couponDiscount = baseAmount * coupon.DiscountValue / 100
			if coupon.MaxDiscountAmount != nil && couponDiscount > *coupon.MaxDiscountAmount {
				couponDiscount = *coupon.MaxDiscountAmount
			}
		default:
			couponDiscount = coupon.DiscountValue
		}
		if couponDiscount > baseAmount {
			couponDiscount = baseAmount
		}
	}

	// create order_coupon
	oc := &models.OrderCoupon{
		ID:             uuid.NewString(),
		OrderID:        orderID,
		Code:           coupon.Code,
		Category:       category,
		DiscountAmount: couponDiscount,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.DB.WithContext(ctx).Create(oc).Error; err != nil {
		return nil, err
	}

	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return s.recalculateOrderTotalsTx(tx, orderID, now)
	}); err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

// RemoveCouponFromOrder removes a specific coupon by code and recalculates totals.
func (s *OrderService) RemoveCouponFromOrder(ctx context.Context, orderID, couponCode string) (*models.Order, error) {
	var ord models.Order
	if err := s.DB.WithContext(ctx).Where("id = ?", orderID).First(&ord).Error; err != nil {
		return nil, err
	}
	if err := s.expireStalePendingOrders(ctx); err != nil {
		return nil, err
	}
	if isOrderLocked(ord) {
		return nil, ErrOrderAlreadyPaid
	}

	// delete the coupon row
	if err := s.DB.WithContext(ctx).Where("order_id = ? AND code = ?", orderID, couponCode).Delete(&models.OrderCoupon{}).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	if err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return s.recalculateOrderTotalsTx(tx, orderID, now)
	}); err != nil {
		return nil, err
	}
	return s.GetOrderByID(ctx, orderID)
}

// OrderListFilter defines filters for listing orders.
type OrderListFilter struct {
	Query           string
	BusinessID      string
	UserID          string
	CustomerID      string
	Status          string
	PaymentStatus   string
	DisputeDecision string
	Channel         string
	From            *time.Time
	To              *time.Time
	Page            int
	Limit           int
	Sort            string
}

// BusinessCustomerHistoryItem summarizes a customer that has prior orders for a business.
type BusinessCustomerHistoryItem struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Email       string     `json:"email"`
	Phone       string     `json:"phone"`
	Locale      string     `json:"locale"`
	IsActive    bool       `json:"is_active"`
	IsBanned    bool       `json:"is_banned"`
	OrderCount  int64      `json:"order_count"`
	LastOrderAt *time.Time `json:"last_order_at,omitempty"`
}

type businessCustomerHistoryRow struct {
	CustomerID  string     `gorm:"column:customer_id"`
	OrderCount  int64      `gorm:"column:order_count"`
	LastOrderAt *time.Time `gorm:"column:last_order_at"`
}

// ListBusinessCustomerHistory returns distinct customers who have at least one non-draft order for a business.
func (s *OrderService) ListBusinessCustomerHistory(ctx context.Context, businessID string, query string, page, limit int) ([]BusinessCustomerHistoryItem, int64, error) {
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		return nil, 0, errors.New("business_id is required")
	}
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	search := strings.TrimSpace(query)
	baseSQL := `
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		WHERE o.business_id = ?
		  AND o.customer_id IS NOT NULL
		  AND o.status <> 'draft'
	`
	args := []any{trimmedBusinessID}
	if search != "" {
		like := "%" + search + "%"
		baseSQL += ` AND (c.name ILIKE ? OR c.email ILIKE ? OR c.phone ILIKE ? OR c.id = ?)`
		args = append(args, like, like, like, search)
	}

	var total int64
	countSQL := `SELECT COUNT(*) FROM (SELECT o.customer_id ` + baseSQL + ` GROUP BY o.customer_id) AS customer_history`
	if err := s.DB.WithContext(ctx).Raw(countSQL, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []businessCustomerHistoryRow
	listSQL := `
		SELECT
			o.customer_id AS customer_id,
			COUNT(*) AS order_count,
			MAX(COALESCE(o.placed_at, o.created_at)) AS last_order_at
		` + baseSQL + `
		GROUP BY o.customer_id
		ORDER BY MAX(COALESCE(o.placed_at, o.created_at)) DESC, o.customer_id ASC
		LIMIT ? OFFSET ?
	`
	listArgs := append(args, limit, (page-1)*limit)
	if err := s.DB.WithContext(ctx).Raw(listSQL, listArgs...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	customerIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		customerIDs = append(customerIDs, row.CustomerID)
	}

	var customers []authmodels.Customer
	if len(customerIDs) > 0 {
		if err := s.DB.WithContext(ctx).Where("id IN ?", customerIDs).Find(&customers).Error; err != nil {
			return nil, 0, err
		}
	}
	customerByID := make(map[string]authmodels.Customer, len(customers))
	for _, customer := range customers {
		customerByID[customer.ID] = customer
	}

	items := make([]BusinessCustomerHistoryItem, 0, len(rows))
	for _, row := range rows {
		customer, ok := customerByID[row.CustomerID]
		if !ok {
			continue
		}
		items = append(items, BusinessCustomerHistoryItem{
			ID:          customer.ID,
			Name:        customer.Name,
			Email:       customer.Email,
			Phone:       customer.Phone,
			Locale:      customer.Locale,
			IsActive:    customer.IsActive,
			IsBanned:    customer.IsBanned,
			OrderCount:  row.OrderCount,
			LastOrderAt: row.LastOrderAt,
		})
	}

	return items, total, nil
}

// ListOrders returns orders matching the provided filter and total count.
func (s *OrderService) ListOrders(ctx context.Context, f OrderListFilter) ([]models.Order, int64, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if err := s.expireStalePendingOrders(ctx); err != nil {
		return nil, 0, err
	}
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 20
	}

	q := s.DB.WithContext(ctx).Model(&models.Order{})

	if f.Query != "" {
		q = q.Where("order_number ILIKE ?", "%"+f.Query+"%")
	}
	if f.BusinessID != "" {
		q = q.Where("business_id = ?", f.BusinessID)
	}
	if f.UserID != "" {
		q = q.Where("user_id = ?", f.UserID)
	}
	if f.CustomerID != "" {
		q = q.Where("customer_id = ?", f.CustomerID)
	}
	if f.Status != "" {
		normalizedStatus := normalizeOrderStatus(f.Status)
		if normalizedStatus == OrderStatusProcessing {
			q = q.Where("status IN ?", []string{OrderStatusProcessing, "confirmed"})
		} else {
			q = q.Where("status = ?", normalizedStatus)
		}
	}
	if f.PaymentStatus != "" {
		q = q.Where("payment_status = ?", f.PaymentStatus)
	}
	if f.DisputeDecision != "" {
		q = q.Where("metadata -> 'dispute' ->> 'admin_decision' = ?", f.DisputeDecision)
	}
	if f.Channel != "" {
		q = q.Where("channel = ?", f.Channel)
	}
	if f.From != nil {
		q = q.Where("created_at >= ?", *f.From)
	}
	if f.To != nil {
		q = q.Where("created_at <= ?", *f.To)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var orders []models.Order

	// sorting: allow limited safe fields
	allowed := map[string]string{
		"created_at":   "created_at",
		"order_number": "order_number",
	}
	orderClause := "created_at desc"
	if f.Sort != "" {
		dir := "asc"
		field := f.Sort
		if f.Sort[0] == '-' {
			dir = "desc"
			field = f.Sort[1:]
		}
		if col, ok := allowed[field]; ok {
			orderClause = col + " " + dir
		}
	}

	if err := q.Preload("OrderItems").Preload("Payments").Preload("Customer").Order(orderClause).Limit(f.Limit).Offset((f.Page - 1) * f.Limit).Find(&orders).Error; err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}
