package services

import (
	"go_framework/internal/storage"
	catalogservices "go_framework/plugins/catalog/services"

	"gorm.io/gorm"
)

type Services struct {
	Cart     *CartService
	Order    *OrderService
	Wishlist *WishlistService
	Payment  *PaymentService
	Catalog  *catalogservices.CatalogService
}

func NewServices(db *gorm.DB, store storage.Store) *Services {
	return &Services{
		Cart:     NewCartService(db),
		Order:    NewOrderService(db),
		Wishlist: NewWishlistService(db),
		Payment:  NewPaymentService(db, store),
		Catalog:  catalogservices.New(db, store),
	}
}
