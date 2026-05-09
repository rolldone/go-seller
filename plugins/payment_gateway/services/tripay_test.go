package services

import (
	"context"
	"encoding/json"
	"testing"

	"go_framework/plugins/payment_gateway/pgwtypes"
)

func TestTripayParseCreatePaymentResponseVA(t *testing.T) {
	t.Parallel()

	adapter := NewTripayAdapter()
	rawResp := []byte(`{"success":true,"message":"success","data":{"reference":"TREF-123","merchant_ref":"payment-123","payment_method":"BRIVA","payment_name":"BRI Virtual Account","checkout_url":"https://tripay.co.id/checkout/TREF-123","pay_code":"1234567890","status":"UNPAID","expired_time":1893456000}}`)
	in := pgwtypes.CreatePaymentInput{
		PaymentID: "payment-123",
		Amount:    40000,
		Currency:  "IDR",
	}

	result, err := adapter.parseCreatePaymentResponse(rawResp, in, "BRIVA")
	if err != nil {
		t.Fatalf("parseCreatePaymentResponse() error = %v", err)
	}
	if result.GatewayTransactionID != "TREF-123" {
		t.Fatalf("GatewayTransactionID = %q, want %q", result.GatewayTransactionID, "TREF-123")
	}
	if result.ProviderTransactionID == nil || *result.ProviderTransactionID != "payment-123" {
		t.Fatalf("ProviderTransactionID = %#v, want payment-123", result.ProviderTransactionID)
	}
	if result.PaymentInstruction.Type != pgwtypes.InstructionTypeVA {
		t.Fatalf("Instruction.Type = %q, want %q", result.PaymentInstruction.Type, pgwtypes.InstructionTypeVA)
	}
	if result.PaymentInstruction.VirtualAccountNumber == nil || *result.PaymentInstruction.VirtualAccountNumber != "1234567890" {
		t.Fatalf("Instruction.VirtualAccountNumber = %#v, want pay code", result.PaymentInstruction.VirtualAccountNumber)
	}
}

func TestTripayParseWebhook(t *testing.T) {
	t.Parallel()

	adapter := NewTripayAdapter()
	providerConfig, _ := json.Marshal(TripayProviderConfig{MerchantCode: "T0001"})
	credentials := `{"api_key":"API-KEY","private_key":"PRIVATE-KEY"}`
	body := []byte(`{"reference":"TREF-123","merchant_ref":"payment-123","status":"PAID","payment_method":"BRIVA","pay_code":"1234567890"}`)
	headers := map[string]string{
		"x-callback-signature": tripayWebhookSignature(body, "PRIVATE-KEY"),
		"x-callback-event":     "payment_status",
	}

	event, err := adapter.ParseWebhook(context.Background(), body, headers, providerConfig, &credentials)
	if err != nil {
		t.Fatalf("ParseWebhook() error = %v", err)
	}
	if event.GatewayTransactionID != "TREF-123" {
		t.Fatalf("GatewayTransactionID = %q, want %q", event.GatewayTransactionID, "TREF-123")
	}
	if event.ProviderTransactionID == nil || *event.ProviderTransactionID != "payment-123" {
		t.Fatalf("ProviderTransactionID = %#v, want payment-123", event.ProviderTransactionID)
	}
	if !event.SignatureValid {
		t.Fatalf("SignatureValid = false, want true")
	}
	if event.Status != pgwtypes.PaymentStatusSucceeded {
		t.Fatalf("Status = %q, want %q", event.Status, pgwtypes.PaymentStatusSucceeded)
	}
}
