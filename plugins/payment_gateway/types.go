// Package payment_gateway — types are defined in pgwtypes sub-package
// to avoid circular imports with the handlers sub-package.
package payment_gateway

import (
	"go_framework/plugins/payment_gateway/pgwtypes"
)

// Re-export type aliases for convenience.
type PaymentGateway = pgwtypes.PaymentGateway
type CreatePaymentRequest = pgwtypes.CreatePaymentRequest
type CreatePaymentResponse = pgwtypes.CreatePaymentResponse
type CallbackResult = pgwtypes.CallbackResult
type PaymentStatus = pgwtypes.PaymentStatus
type RefundResult = pgwtypes.RefundResult
