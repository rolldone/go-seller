package services

import (
	"context"
	"time"

	"go_framework/plugins/order/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentService struct {
	DB *gorm.DB
}

func NewPaymentService(db *gorm.DB) *PaymentService {
	return &PaymentService{DB: db}
}

func (s *PaymentService) CreatePayment(ctx context.Context, p *models.Payment) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now
	return s.DB.WithContext(ctx).Create(p).Error
}

func (s *PaymentService) UpdatePaymentStatus(ctx context.Context, paymentID, status string, paidAt *time.Time) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var p models.Payment
		if err := tx.Where("id = ?", paymentID).First(&p).Error; err != nil {
			return err
		}
		p.Status = status
		if paidAt != nil {
			p.PaidAt = paidAt
		}
		if err := tx.Save(&p).Error; err != nil {
			return err
		}
		if status == "succeeded" {
			if err := tx.Model(&models.Order{}).Where("id = ?", p.OrderID).Updates(map[string]interface{}{"payment_status": "paid", "paid_at": paidAt}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
