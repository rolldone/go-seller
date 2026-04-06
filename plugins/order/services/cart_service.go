package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	catalogmodels "go_framework/plugins/catalog/models"
	"go_framework/plugins/order/models"
	settingmodels "go_framework/plugins/setting/models"

	"go_framework/internal/uuid"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CartService struct {
	DB *gorm.DB
}

type CartItemSnapshot struct {
	ProductID    string
	ProductName  string
	BusinessID   *string
	BusinessName string
	VariationID  *string
	SKU          *string
	ImageURL     *string
	Qty          int
	UnitPrice    float64
}

type CartItemPreview struct {
	ID             string  `json:"id,omitempty"`
	ProductID      *string `json:"product_id,omitempty"`
	ProductName    string  `json:"product_name,omitempty"`
	VariationID    *string `json:"variation_id,omitempty"`
	SKU            *string `json:"sku,omitempty"`
	ImageURL       *string `json:"image_url,omitempty"`
	Qty            int     `json:"qty"`
	UnitPrice      float64 `json:"unit_price"`
	LineTotal      float64 `json:"line_total"`
	DiscountAmount float64 `json:"discount_amount"`
	NetTotal       float64 `json:"net_total"`
	TaxAmount      float64 `json:"tax_amount"`
	TaxType        string  `json:"tax_type,omitempty"`
	TaxRate        float64 `json:"tax_rate,omitempty"`
	PayableTotal   float64 `json:"payable_total"`
}

type AppliedCoupon struct {
	Code           string  `json:"code"`
	Category       string  `json:"category"`
	DiscountAmount float64 `json:"discount_amount"`
}

type CartPreview struct {
	Cart           *models.Cart      `json:"cart"`
	Items          []CartItemPreview `json:"items"`
	Subtotal       float64           `json:"subtotal"`
	DiscountAmount float64           `json:"discount_amount"`
	TaxAmount      float64           `json:"tax_amount"`
	ShippingAmount float64           `json:"shipping_amount"`
	GrandTotal     float64           `json:"grand_total"`
	AppliedCoupons []AppliedCoupon   `json:"applied_coupons,omitempty"`
}

type CartBusinessSummary struct {
	CartID       string    `json:"cart_id"`
	BusinessID   string    `json:"business_id"`
	BusinessName string    `json:"business_name"`
	BusinessSlug string    `json:"business_slug"`
	ItemCount    int64     `json:"item_count"`
	TotalQty     int64     `json:"total_qty"`
	TotalAmount  float64   `json:"total_amount"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// normalizeCouponCategory mirrors order_service.normalizeAppliedCouponCategory
func normalizeCouponCategory(value string) string {
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

func NewCartService(db *gorm.DB) *CartService {
	return &CartService{DB: db}
}

func normalizeTaxRule(taxType string, taxRate float64) (string, float64) {
	normalizedType := strings.ToLower(strings.TrimSpace(taxType))
	if normalizedType != "include" {
		normalizedType = "exclude"
	}
	normalizedRate := taxRate
	if normalizedRate > 1 {
		normalizedRate = normalizedRate / 100
	}
	if normalizedRate < 0 {
		normalizedRate = 0
	}
	return normalizedType, normalizedRate
}

func calculateTaxedLineTotal(lineNet float64, taxType string, taxRate float64) (float64, float64) {
	if lineNet <= 0 {
		return 0, 0
	}
	normalizedType, normalizedRate := normalizeTaxRule(taxType, taxRate)
	if normalizedRate <= 0 {
		return 0, lineNet
	}
	if normalizedType == "include" {
		lineTax := lineNet - (lineNet / (1 + normalizedRate))
		return lineTax, lineNet
	}
	lineTax := lineNet * normalizedRate
	return lineTax, lineNet + lineTax
}

func (s *CartService) getOrCreateActiveCartWithDB(db *gorm.DB, ctx context.Context, customerID string, businessID *string) (*models.Cart, error) {
	var cart models.Cart
	query := db.WithContext(ctx).
		Where("customer_id = ? AND status = ?", customerID, "active").
		Where("business_id IS NOT DISTINCT FROM ?", businessID)
	if err := query.Order("updated_at DESC").First(&cart).Error; err == nil {
		return &cart, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := time.Now()
	cart = models.Cart{
		ID:         uuid.NewString(),
		CustomerID: customerID,
		BusinessID: businessID,
		Status:     "active",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	res := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&cart)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		if err := db.WithContext(ctx).
			Where("customer_id = ? AND business_id IS NOT DISTINCT FROM ? AND status = ?", customerID, businessID, "active").
			Order("updated_at DESC").
			First(&cart).Error; err != nil {
			return nil, err
		}
	}
	return &cart, nil
}

func (s *CartService) CreateCart(ctx context.Context, customerID string, businessID *string) (*models.Cart, error) {
	return s.getOrCreateActiveCartWithDB(s.DB, ctx, customerID, businessID)
}

func (s *CartService) GetOrCreateActiveCart(ctx context.Context, customerID string, businessID *string) (*models.Cart, error) {
	return s.getOrCreateActiveCartWithDB(s.DB, ctx, customerID, businessID)
}

func (s *CartService) GetCartWithItemsByCustomer(ctx context.Context, customerID string, businessID *string) (*models.Cart, []models.CartItem, error) {
	cart, err := s.GetOrCreateActiveCart(ctx, customerID, businessID)
	if err != nil {
		return nil, nil, err
	}
	var items []models.CartItem
	if err := s.DB.WithContext(ctx).Where("cart_id = ?", cart.ID).Order("created_at ASC").Find(&items).Error; err != nil {
		return cart, nil, err
	}
	return cart, items, nil
}

func (s *CartService) AddItemToCustomerCart(ctx context.Context, customerID string, snapshot CartItemSnapshot) (*models.Cart, []models.CartItem, *models.CartItem, error) {
	if strings.TrimSpace(snapshot.ProductID) == "" {
		return nil, nil, nil, errors.New("product_id is required")
	}
	if snapshot.Qty <= 0 {
		return nil, nil, nil, errors.New("qty must be > 0")
	}
	if snapshot.UnitPrice < 0 {
		return nil, nil, nil, errors.New("unit_price must be non-negative")
	}

	var (
		cart  *models.Cart
		item  models.CartItem
		items []models.CartItem
	)

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		lockedCart, err := s.getOrCreateActiveCartWithDB(tx, ctx, customerID, snapshot.BusinessID)
		if err != nil {
			return err
		}
		cart = lockedCart

		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", cart.ID).First(&models.Cart{}).Error; err != nil {
			return err
		}

		baseQuery := tx.Where("cart_id = ? AND product_id = ?", cart.ID, snapshot.ProductID)
		if snapshot.VariationID != nil && strings.TrimSpace(*snapshot.VariationID) != "" {
			baseQuery = baseQuery.Where("variation_id = ?", strings.TrimSpace(*snapshot.VariationID))
		} else {
			baseQuery = baseQuery.Where("variation_id IS NULL")
		}

		if err := baseQuery.First(&item).Error; err == nil {
			item.Qty += snapshot.Qty
			item.UnitPrice = snapshot.UnitPrice
			item.Total = float64(item.Qty) * snapshot.UnitPrice
			item.ProductName = snapshot.ProductName
			item.BusinessName = snapshot.BusinessName
			item.VariationID = snapshot.VariationID
			item.SKU = snapshot.SKU
			item.ImageURL = snapshot.ImageURL
			item.UpdatedAt = time.Now()
			if err := tx.Save(&item).Error; err != nil {
				return err
			}
		} else {
			now := time.Now()
			productID := snapshot.ProductID
			item = models.CartItem{
				ID:           uuid.NewString(),
				CartID:       cart.ID,
				ProductID:    &productID,
				ProductName:  snapshot.ProductName,
				BusinessName: snapshot.BusinessName,
				VariationID:  snapshot.VariationID,
				SKU:          snapshot.SKU,
				ImageURL:     snapshot.ImageURL,
				Qty:          snapshot.Qty,
				UnitPrice:    snapshot.UnitPrice,
				Total:        float64(snapshot.Qty) * snapshot.UnitPrice,
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
		}

		if err := tx.Where("cart_id = ?", cart.ID).Order("created_at ASC").Find(&items).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, nil, nil, err
	}
	return cart, items, &item, nil
}

func (s *CartService) UpdateCartItemQtyByCustomer(ctx context.Context, customerID, itemID string, qty int) (*models.Cart, []models.CartItem, *models.CartItem, error) {
	if qty <= 0 {
		return nil, nil, nil, errors.New("qty must be > 0")
	}

	var item models.CartItem
	if err := s.DB.WithContext(ctx).
		Table("cart_items").
		Select("cart_items.*").
		Joins("JOIN carts ON carts.id = cart_items.cart_id").
		Where("cart_items.id = ? AND carts.customer_id = ?", itemID, customerID).
		First(&item).Error; err != nil {
		return nil, nil, nil, err
	}

	item.Qty = qty
	item.Total = float64(item.Qty) * item.UnitPrice
	item.UpdatedAt = time.Now()
	if err := s.DB.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, nil, nil, err
	}

	cart, items, err := s.GetCartWithItems(ctx, item.CartID)
	if err != nil {
		return nil, nil, nil, err
	}
	return cart, items, &item, nil
}

func (s *CartService) DeleteCartItemByCustomer(ctx context.Context, customerID, itemID string) (*models.Cart, []models.CartItem, error) {
	var item models.CartItem
	if err := s.DB.WithContext(ctx).
		Table("cart_items").
		Select("cart_items.*").
		Joins("JOIN carts ON carts.id = cart_items.cart_id").
		Where("cart_items.id = ? AND carts.customer_id = ?", itemID, customerID).
		First(&item).Error; err != nil {
		return nil, nil, err
	}

	if err := s.DB.WithContext(ctx).Delete(&models.CartItem{}, "id = ?", itemID).Error; err != nil {
		return nil, nil, err
	}
	updatedCart, updatedItems, err := s.GetCartWithItems(ctx, item.CartID)
	if err != nil {
		return nil, nil, err
	}
	return updatedCart, updatedItems, nil
}

func (s *CartService) AddItemToCart(ctx context.Context, cartID, productID string, qty int, unitPrice float64) (*models.CartItem, error) {
	if qty <= 0 {
		return nil, errors.New("qty must be > 0")
	}
	var cart models.Cart
	if err := s.DB.WithContext(ctx).Where("id = ?", cartID).First(&cart).Error; err != nil {
		return nil, err
	}

	var item models.CartItem
	if err := s.DB.WithContext(ctx).Where("cart_id = ? AND product_id = ?", cartID, productID).First(&item).Error; err == nil {
		item.Qty += qty
		item.UnitPrice = unitPrice
		item.Total = float64(item.Qty) * unitPrice
		item.UpdatedAt = time.Now()
		if err := s.DB.WithContext(ctx).Save(&item).Error; err != nil {
			return nil, err
		}
		return &item, nil
	}

	now := time.Now()
	item = models.CartItem{
		ID:        uuid.NewString(),
		CartID:    cartID,
		ProductID: &productID,
		Qty:       qty,
		UnitPrice: unitPrice,
		Total:     float64(qty) * unitPrice,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.DB.WithContext(ctx).Create(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *CartService) GetCartWithItems(ctx context.Context, cartID string) (*models.Cart, []models.CartItem, error) {
	var cart models.Cart
	if err := s.DB.WithContext(ctx).Where("id = ?", cartID).First(&cart).Error; err != nil {
		return nil, nil, err
	}
	var items []models.CartItem
	if err := s.DB.WithContext(ctx).Where("cart_id = ?", cartID).Find(&items).Error; err != nil {
		return &cart, nil, err
	}
	return &cart, items, nil
}

// PreviewCartForCustomer computes a server-side preview of the cart totals,
// including product discounts (active) and an optional coupon code effect.
func (s *CartService) PreviewCartForCustomer(ctx context.Context, customerID string, businessID *string, couponCode *string) (*CartPreview, error) {
	cart, items, err := s.GetCartWithItemsByCustomer(ctx, customerID, businessID)
	if err != nil {
		return nil, err
	}

	previews := make([]CartItemPreview, 0, len(items))
	productIDs := make([]string, 0)
	for _, it := range items {
		lt := float64(it.Qty) * it.UnitPrice
		previews = append(previews, CartItemPreview{
			ID:             it.ID,
			ProductID:      it.ProductID,
			ProductName:    it.ProductName,
			VariationID:    it.VariationID,
			SKU:            it.SKU,
			ImageURL:       it.ImageURL,
			Qty:            it.Qty,
			UnitPrice:      it.UnitPrice,
			LineTotal:      lt,
			DiscountAmount: 0,
			NetTotal:       lt,
		})
		if it.ProductID != nil && strings.TrimSpace(*it.ProductID) != "" {
			productIDs = append(productIDs, *it.ProductID)
		}
	}

	subtotal := 0.0
	for _, p := range previews {
		subtotal += p.LineTotal
	}

	// Fetch active discounts for these product IDs (grouped by product)
	discountMap := make(map[string][]catalogmodels.Discount)
	if len(productIDs) > 0 {
		now := time.Now().UTC()
		var activeDiscounts []catalogmodels.Discount
		if err := s.DB.WithContext(ctx).
			Where("is_active = ? AND start_at <= ? AND (end_at IS NULL OR end_at >= ?)", true, now, now).
			Order("priority DESC, created_at DESC").
			Find(&activeDiscounts).Error; err != nil {
			return nil, err
		}
		if len(activeDiscounts) > 0 {
			discountIDs := make([]string, 0, len(activeDiscounts))
			for _, d := range activeDiscounts {
				discountIDs = append(discountIDs, d.ID)
			}
			var relations []catalogmodels.DiscountProduct
			if err := s.DB.WithContext(ctx).
				Where("discount_id IN ? AND product_id IN ?", discountIDs, productIDs).
				Order("discount_id, product_id").
				Find(&relations).Error; err != nil {
				return nil, err
			}
			dm := make(map[string]catalogmodels.Discount, len(activeDiscounts))
			for _, d := range activeDiscounts {
				dm[d.ID] = d
			}
			for _, rel := range relations {
				if d, ok := dm[rel.DiscountID]; ok {
					discountMap[rel.ProductID] = append(discountMap[rel.ProductID], d)
				}
			}
		}
	}

	// Apply product discounts (pick first applicable by priority)
	totalProductDiscount := 0.0
	for i := range previews {
		p := &previews[i]
		if p.ProductID == nil || strings.TrimSpace(*p.ProductID) == "" {
			continue
		}
		ds := discountMap[*p.ProductID]
		if len(ds) == 0 {
			continue
		}
		for _, d := range ds {
			now := time.Now()
			if !d.IsActive {
				continue
			}
			if now.Before(d.StartAt) {
				continue
			}
			if d.EndAt != nil && now.After(*d.EndAt) {
				continue
			}
			if d.MinOrderAmount != nil && subtotal < *d.MinOrderAmount {
				continue
			}
			if d.ProductMinQty != nil && p.Qty < *d.ProductMinQty {
				continue
			}
			effectiveQty := float64(p.Qty)
			if d.ProductQtyLimit != nil && *d.ProductQtyLimit > 0 && effectiveQty > float64(*d.ProductQtyLimit) {
				effectiveQty = float64(*d.ProductQtyLimit)
			}
			baseAmount := effectiveQty * p.UnitPrice
			if baseAmount <= 0 {
				continue
			}
			discAmt := 0.0
			switch d.DiscountType {
			case "percentage":
				discAmt = baseAmount * d.DiscountValue / 100
			default:
				discAmt = d.DiscountValue
			}
			if d.MaxDiscountAmount != nil && discAmt > *d.MaxDiscountAmount {
				discAmt = *d.MaxDiscountAmount
			}
			if discAmt > baseAmount {
				discAmt = baseAmount
			}
			if discAmt < 0 {
				discAmt = 0
			}
			if discAmt > 0 {
				p.DiscountAmount = discAmt
				p.NetTotal = p.LineTotal - discAmt
				totalProductDiscount += discAmt
				break
			}
		}
	}

	// Optional coupon calculation
	couponTotal := 0.0
	applied := make([]AppliedCoupon, 0)
	if couponCode != nil && strings.TrimSpace(*couponCode) != "" {
		code := strings.TrimSpace(*couponCode)
		var coupon catalogmodels.Coupon
		if err := s.DB.WithContext(ctx).Where("UPPER(code) = UPPER(?)", code).First(&coupon).Error; err != nil {
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
		if coupon.MinOrderAmount != nil && subtotal < *coupon.MinOrderAmount {
			return nil, errors.New("order amount does not meet minimum for this coupon")
		}

		category := normalizeCouponCategory(coupon.Category)
		couponDiscount := 0.0
		if category == "cashback" {
			couponDiscount = 0
		} else if category == "shipping_discount" {
			baseAmount := 0.0
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
			baseAmount := subtotal
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
		} else {
			var prodIDs []string
			if err := s.DB.WithContext(ctx).
				Table("coupon_products").
				Select("product_id").
				Where("coupon_id = ?", coupon.ID).
				Order("product_id").
				Pluck("product_id", &prodIDs).Error; err != nil {
				return nil, err
			}
			baseAmount := 0.0
			if len(prodIDs) == 0 {
				baseAmount = subtotal
			} else {
				for _, it := range previews {
					if it.ProductID == nil {
						continue
					}
					for _, pid := range prodIDs {
						if *it.ProductID == pid {
							baseAmount += it.NetTotal
							break
						}
					}
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
		if couponDiscount < 0 {
			couponDiscount = 0
		}
		couponTotal = couponDiscount
		applied = append(applied, AppliedCoupon{Code: coupon.Code, Category: coupon.Category, DiscountAmount: couponDiscount})
	}

	totalDiscount := totalProductDiscount + couponTotal

	globalTaxType := "exclude"
	globalTaxRate := 0.0
	var globalSetting settingmodels.Setting
	if err := s.DB.WithContext(ctx).Where("scope = ? AND key = ?", "global", "tax.default").First(&globalSetting).Error; err == nil {
		var payload struct {
			TaxType string  `json:"tax_type"`
			TaxRate float64 `json:"tax_rate"`
		}
		if err := json.Unmarshal(globalSetting.Value, &payload); err == nil {
			globalTaxType = payload.TaxType
			globalTaxRate = payload.TaxRate
		}
	}
	globalTaxType, globalTaxRate = normalizeTaxRule(globalTaxType, globalTaxRate)

	productMap := make(map[string]catalogmodels.Product)
	if len(productIDs) > 0 {
		var products []catalogmodels.Product
		if err := s.DB.WithContext(ctx).Where("id IN ?", productIDs).Find(&products).Error; err != nil {
			return nil, err
		}
		for _, product := range products {
			productMap[product.ID] = product
		}
	}

	totalTax := 0.0
	totalLineWithTax := 0.0
	for i := range previews {
		p := &previews[i]
		lineNet := p.LineTotal - p.DiscountAmount
		if lineNet < 0 {
			lineNet = 0
		}

		taxType := globalTaxType
		taxRate := globalTaxRate
		if p.ProductID != nil {
			if product, ok := productMap[strings.TrimSpace(*p.ProductID)]; ok && product.CustomTax {
				taxType = product.TaxType
				taxRate = product.TaxRate
			}
		}
		taxType, taxRate = normalizeTaxRule(taxType, taxRate)

		lineTax, lineTotalWithTax := calculateTaxedLineTotal(lineNet, taxType, taxRate)
		p.TaxType = taxType
		p.TaxRate = taxRate
		p.TaxAmount = lineTax
		p.PayableTotal = lineTotalWithTax

		totalTax += lineTax
		totalLineWithTax += lineTotalWithTax
	}

	grand := totalLineWithTax - couponTotal
	if grand < 0 {
		grand = 0
	}

	preview := &CartPreview{
		Cart:           cart,
		Items:          previews,
		Subtotal:       subtotal,
		DiscountAmount: totalDiscount,
		TaxAmount:      totalTax,
		ShippingAmount: 0,
		GrandTotal:     grand,
		AppliedCoupons: applied,
	}
	return preview, nil
}

func (s *CartService) ListCartBusinessesByCustomer(ctx context.Context, customerID string) ([]CartBusinessSummary, error) {
	var rows []CartBusinessSummary
	err := s.DB.WithContext(ctx).
		Table("carts AS c").
		Select(`
			c.id AS cart_id,
			c.business_id AS business_id,
			COALESCE(b.name, MAX(ci.business_name), '-') AS business_name,
			COALESCE(b.slug, '') AS business_slug,
			COUNT(ci.id) AS item_count,
			COALESCE(SUM(ci.qty), 0) AS total_qty,
			COALESCE(SUM(ci.total), 0) AS total_amount,
			COALESCE(MAX(ci.updated_at), c.updated_at) AS updated_at
		`).
		Joins("JOIN cart_items AS ci ON ci.cart_id = c.id").
		Joins("LEFT JOIN businesses AS b ON b.id = c.business_id").
		Where("c.customer_id = ? AND c.status = ? AND c.deleted_at IS NULL", customerID, "active").
		Where("c.business_id IS NOT NULL").
		Group("c.id, c.business_id, b.slug, b.name, c.updated_at").
		Having("COUNT(ci.id) > 0").
		Order("COALESCE(MAX(ci.updated_at), c.updated_at) DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}
