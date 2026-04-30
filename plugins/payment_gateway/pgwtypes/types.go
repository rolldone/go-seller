package pgwtypes

import (
	"time"

	"github.com/gin-gonic/gin"
)

// PaymentGateway is the interface every payment gateway integration must implement.
// Register implementations via the parent package's RegisterGateway function.
type PaymentGateway interface {
	Key() string
	Name() string
	SupportedCurrencies() []string
	CreatePayment(req CreatePaymentRequest) (CreatePaymentResponse, error)
	HandleCallback(ctx *gin.Context) (CallbackResult, error)
	GetStatus(paymentID string) (PaymentStatus, error)
	Refund(paymentID string, amount int64) (RefundResult, error)
}

type CreatePaymentRequest struct {
	OrderID     string                 `json:"order_id"`
	Amount      int64                  `json:"amount"`
	Currency    string                 `json:"currency"`
	CustomerID  string                 `json:"customer_id,omitempty"`
	ProviderKey string                 `json:"provider_key"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type CreatePaymentResponse struct {
	ProviderTransactionID string                 `json:"provider_transaction_id,omitempty"`
	PaymentURL            string                 `json:"payment_url,omitempty"`
	Status                string                 `json:"status"`
	Amount                int64                  `json:"amount"`
	Currency              string                 `json:"currency"`
	Metadata              map[string]interface{} `json:"metadata,omitempty"`
}

type CallbackResult struct {
	OrderID               string                 `json:"order_id"`
	ProviderKey           string                 `json:"provider_key"`
	ProviderTransactionID string                 `json:"provider_transaction_id"`
	Status                string                 `json:"status"`
	Amount                int64                  `json:"amount"`
	Currency              string                 `json:"currency"`
	Metadata              map[string]interface{} `json:"metadata,omitempty"`
}

type PaymentStatus struct {
	ProviderTransactionID string                 `json:"provider_transaction_id"`
	Status                string                 `json:"status"`
	Amount                int64                  `json:"amount"`
	Currency              string                 `json:"currency"`
	UpdatedAt             time.Time              `json:"updated_at"`
	Metadata              map[string]interface{} `json:"metadata,omitempty"`
}

type RefundResult struct {
	RefundID string                 `json:"refund_id"`
	Status   string                 `json:"status"`
	Amount   int64                  `json:"amount"`
	Currency string                 `json:"currency"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}
