package services

import (
	"context"
	"time"

	"go_framework/plugins/order/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WishlistService struct {
	DB *gorm.DB
}

func NewWishlistService(db *gorm.DB) *WishlistService {
	return &WishlistService{DB: db}
}

func (s *WishlistService) CreateWishlist(ctx context.Context, userID string, businessID *string) (*models.Wishlist, error) {
	now := time.Now()
	w := models.Wishlist{
		ID:         uuid.NewString(),
		UserID:     userID,
		BusinessID: businessID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.DB.WithContext(ctx).Create(&w).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WishlistService) AddItem(ctx context.Context, wishlistID, productID string) (*models.WishlistItem, error) {
	now := time.Now()
	it := models.WishlistItem{
		ID:         uuid.NewString(),
		WishlistID: wishlistID,
		ProductID:  &productID,
		CreatedAt:  now,
	}
	if err := s.DB.WithContext(ctx).Create(&it).Error; err != nil {
		return nil, err
	}
	return &it, nil
}

func (s *WishlistService) GetWishlist(ctx context.Context, wishlistID string) (*models.Wishlist, []models.WishlistItem, error) {
	var w models.Wishlist
	if err := s.DB.WithContext(ctx).Where("id = ?", wishlistID).First(&w).Error; err != nil {
		return nil, nil, err
	}
	var items []models.WishlistItem
	if err := s.DB.WithContext(ctx).Where("wishlist_id = ?", wishlistID).Find(&items).Error; err != nil {
		return &w, nil, err
	}
	return &w, items, nil
}
