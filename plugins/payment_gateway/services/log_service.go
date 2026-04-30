package services

import (
	"context"
	"encoding/json"
	"time"

	"go_framework/plugins/payment_gateway/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LogEntry is the input used to persist one transaction log record.
type LogEntry struct {
	BusinessID            *string
	ProviderKey           string
	Direction             models.LogDirection
	EventType             models.LogEventType
	ReferenceID           *string
	ProviderTransactionID *string
	Status                *string
	Amount                *int64
	Currency              *string
	RequestPayload        interface{}
	ResponsePayload       interface{}
	ErrorMessage          *string
	IPAddress             *string
}

// LogListFilter defines optional query filters when fetching logs.
type LogListFilter struct {
	ProviderKey string
	Direction   string
	EventType   string
	ReferenceID string
	Page        int
	PerPage     int
}

// LogService provides methods for persisting and querying payment gateway transaction logs.
type LogService struct {
	db *gorm.DB
}

// New creates a new LogService.
func New(db *gorm.DB) *LogService {
	return &LogService{db: db}
}

// Save persists a LogEntry as a PaymentGatewayTransactionLog row.
func (s *LogService) Save(ctx context.Context, entry LogEntry) error {
	reqBytes, _ := marshalPayload(entry.RequestPayload)
	respBytes, _ := marshalPayload(entry.ResponsePayload)

	record := models.PaymentGatewayTransactionLog{
		ID:                    uuid.New().String(),
		BusinessID:            entry.BusinessID,
		ProviderKey:           entry.ProviderKey,
		Direction:             entry.Direction,
		EventType:             entry.EventType,
		ReferenceID:           entry.ReferenceID,
		ProviderTransactionID: entry.ProviderTransactionID,
		Status:                entry.Status,
		Amount:                entry.Amount,
		Currency:              entry.Currency,
		RequestPayload:        reqBytes,
		ResponsePayload:       respBytes,
		ErrorMessage:          entry.ErrorMessage,
		IPAddress:             entry.IPAddress,
		CreatedAt:             time.Now(),
	}

	return s.db.WithContext(ctx).Create(&record).Error
}

// List returns paginated logs, most recent first.
func (s *LogService) List(ctx context.Context, f LogListFilter) ([]models.PaymentGatewayTransactionLog, int64, error) {
	q := s.db.WithContext(ctx).Model(&models.PaymentGatewayTransactionLog{})

	if f.ProviderKey != "" {
		q = q.Where("provider_key = ?", f.ProviderKey)
	}
	if f.Direction != "" {
		q = q.Where("direction = ?", f.Direction)
	}
	if f.EventType != "" {
		q = q.Where("event_type = ?", f.EventType)
	}
	if f.ReferenceID != "" {
		q = q.Where("reference_id = ?", f.ReferenceID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if f.PerPage <= 0 {
		f.PerPage = 50
	}
	if f.Page <= 0 {
		f.Page = 1
	}
	offset := (f.Page - 1) * f.PerPage

	var logs []models.PaymentGatewayTransactionLog
	err := q.Order("created_at DESC").Limit(f.PerPage).Offset(offset).Find(&logs).Error
	return logs, total, err
}

func marshalPayload(v interface{}) ([]byte, error) {
	if v == nil {
		return []byte("{}"), nil
	}
	switch t := v.(type) {
	case []byte:
		if len(t) == 0 {
			return []byte("{}"), nil
		}
		return t, nil
	case string:
		if t == "" {
			return []byte("{}"), nil
		}
		return []byte(t), nil
	default:
		return json.Marshal(v)
	}
}
