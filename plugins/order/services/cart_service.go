package services

import (
	"context"
	"errors"
	"time"

	"go_framework/plugins/order/models"

	"go_framework/internal/uuid"

	"gorm.io/gorm"
)

type CartService struct {
	DB *gorm.DB
}

func NewCartService(db *gorm.DB) *CartService {
	return &CartService{DB: db}
}

func (s *CartService) CreateCart(ctx context.Context, userID string, businessID *string) (*models.Cart, error) {
	var c models.Cart
	if err := s.DB.WithContext(ctx).Where("user_id = ? AND business_id IS NOT DISTINCT FROM ? AND status = ?", userID, businessID, "active").First(&c).Error; err == nil {
		return &c, nil
	}
	now := time.Now()
	c = models.Cart{
		ID:         uuid.NewString(),
		UserID:     userID,
		BusinessID: businessID,
		Status:     "active",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.DB.WithContext(ctx).Create(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
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
