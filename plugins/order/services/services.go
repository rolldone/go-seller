package services

import (
	"go_framework/internal/storage"

	"gorm.io/gorm"
)

type Services struct {
	Cart     *CartService
	Order    *OrderService
	Wishlist *WishlistService
	Payment  *PaymentService
}

func NewServices(db *gorm.DB, store storage.Store) *Services {
	return &Services{
		Cart:     NewCartService(db),
		Order:    NewOrderService(db),
		Wishlist: NewWishlistService(db),
		Payment:  NewPaymentService(db, store),
	}
}
