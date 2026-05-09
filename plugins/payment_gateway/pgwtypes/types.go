// Package pgwtypes defines the shared types used by all payment gateway adapters.
package pgwtypes

import (
	"context"
	"encoding/json"
	"time"
)

// CreatePaymentInput adalah data yang diperlukan adapter untuk membuat transaksi di gateway.
type CreatePaymentInput struct {
	// OrderID internal
	OrderID string
	// PaymentID internal (akan disimpan sebagai idempotency key)
	PaymentID string
	// Amount dalam satuan terkecil mata uang (misalnya: rupiah penuh, bukan sen)
	Amount float64
	// Currency 3-letter code, misal "IDR"
	Currency string
	// MethodConfig config JSON dari payment_methods.config
	MethodConfig json.RawMessage
	// ProviderConfig config JSON dari payment_providers.config (non-secret)
	ProviderConfig json.RawMessage
	// ServerKey / secret diambil adapter sendiri dari CredentialsEncrypted
	CredentialsEncrypted *string
	// CustomerName untuk data transaksi gateway
	CustomerName string
	// CustomerEmail opsional
	CustomerEmail string
	// CustomerPhone opsional
	CustomerPhone string
	// ExpiredAt batas waktu bayar; nil = biarkan gateway menentukan
	ExpiredAt *time.Time
	// Metadata tambahan yang diteruskan ke gateway
	Metadata map[string]any
	Mode     string `json:"mode"` // Added field for explicit direct/native mode
}

// CreatePaymentResult hasil pembuatan transaksi dari gateway.
type CreatePaymentResult struct {
	// GatewayTransactionID ID transaksi dari gateway
	GatewayTransactionID string
	// ProviderTransactionID alias atau order_id di sisi gateway
	ProviderTransactionID *string
	// ExternalReference referensi nomor VA / kode bayar / token
	ExternalReference *string
	// PaymentInstruction detail instruksi untuk ditampilkan ke user
	PaymentInstruction PaymentInstruction
	// RawResponse payload mentah dari gateway untuk audit
	RawResponse json.RawMessage
	// InitialStatus status awal payment setelah dibuat (biasanya "pending")
	InitialStatus string
	// ExpiredAt batas waktu dari gateway (bisa override nilai input)
	ExpiredAt *time.Time
}

// PaymentInstruction berisi informasi instruksi pembayaran untuk ditampilkan ke user.
type PaymentInstruction struct {
	// Type tipe instruksi: "va", "qris", "redirect", "ewallet", "cash"
	Type string `json:"type"`
	// DisplayName nama metode yang ramah ditampilkan
	DisplayName string `json:"display_name"`
	// VirtualAccountNumber nomor VA (jika type=va)
	VirtualAccountNumber *string `json:"virtual_account_number,omitempty"`
	// BankCode kode bank (jika type=va), misal "bca"
	BankCode *string `json:"bank_code,omitempty"`
	// QRString raw QR string untuk di-render menjadi kode QR
	QRString *string `json:"qr_string,omitempty"`
	// RedirectURL URL untuk redirect user (jika type=redirect/ewallet)
	RedirectURL *string `json:"redirect_url,omitempty"`
	// Amount jumlah yang harus dibayar
	Amount float64 `json:"amount"`
	// Currency kode mata uang
	Currency string `json:"currency"`
	// ExpiredAt batas waktu pembayaran
	ExpiredAt *time.Time `json:"expired_at,omitempty"`
	// Steps langkah-langkah pembayaran opsional
	Steps []string `json:"steps,omitempty"`
	// ExtraInfo data tambahan spesifik gateway
	ExtraInfo map[string]any `json:"extra_info,omitempty"`
}

// WebhookEvent adalah hasil parsing webhook dari gateway menjadi format internal.
type WebhookEvent struct {
	// PaymentID (GatewayTransactionID atau idempotency_key) untuk mencari Payment internal
	GatewayTransactionID string
	// ProviderTransactionID ID transaksi di sisi gateway
	ProviderTransactionID *string
	// ExternalReference referensi tambahan
	ExternalReference *string
	// Status status pembayaran setelah event: "succeeded", "failed", "pending", dll
	Status string
	// PaidAt waktu pembayaran berhasil (jika status succeeded)
	PaidAt *time.Time
	// EventType tipe event dari gateway, misal "payment.settlement"
	EventType string
	// IdempotencyKey key untuk mencegah double-process event yang sama
	IdempotencyKey *string
	// RawPayload payload mentah dari webhook untuk disimpan di PaymentGatewayHistory
	RawPayload json.RawMessage
	// SignatureValid hasil verifikasi signature
	SignatureValid bool
}

// Adapter adalah kontrak yang harus diimplementasikan setiap gateway adapter.
type Adapter interface {
	// ProviderKey mengembalikan provider_key yang dikenali adapter ini, misal "midtrans"
	ProviderKey() string

	// CreatePayment membuat transaksi di gateway dan mengembalikan instruksi pembayaran.
	CreatePayment(ctx context.Context, in CreatePaymentInput) (*CreatePaymentResult, error)

	// ParseWebhook memverifikasi dan mem-parse payload webhook menjadi WebhookEvent.
	// rawBody = raw request body, headers = semua header HTTP request.
	ParseWebhook(ctx context.Context, rawBody []byte, headers map[string]string, providerConfig json.RawMessage, credentialsEncrypted *string) (*WebhookEvent, error)
}
