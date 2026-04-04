package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"go_framework/plugins/order/models"

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

func NewCartService(db *gorm.DB) *CartService {
	return &CartService{DB: db}
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
