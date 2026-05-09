package services

import (
	"context"
	"encoding/json"
	"testing"

	"go_framework/plugins/payment_gateway/pgwtypes"
)

func TestIPaymuParseCreatePaymentResponseVA(t *testing.T) {
	t.Parallel()

	adapter := NewIPaymuAdapter()
	rawResp := []byte(`{"Status":200,"Message":"Success","Data":{"TransactionId":"TRX-123","ReferenceId":"payment-123","SessionId":"SID-123","PaymentNo":"7007000012345678","Via":"va","Channel":"bca","Expired":"2026-05-10 10:00:00"}}`)
	in := pgwtypes.CreatePaymentInput{PaymentID: "payment-123", Amount: 40000, Currency: "IDR"}
	mc := IPaymuMethodConfig{PaymentMethod: "va", PaymentChannel: "bca"}

	result, err := adapter.parseCreatePaymentResponse(rawResp, in, mc)
	if err != nil {
		t.Fatalf("parseCreatePaymentResponse() error = %v", err)
	}
	if result.GatewayTransactionID != "TRX-123" {
		t.Fatalf("GatewayTransactionID = %q, want %q", result.GatewayTransactionID, "TRX-123")
	}
	if result.ProviderTransactionID == nil || *result.ProviderTransactionID != "payment-123" {
		t.Fatalf("ProviderTransactionID = %#v, want payment-123", result.ProviderTransactionID)
	}
	if result.PaymentInstruction.Type != pgwtypes.InstructionTypeVA {
		t.Fatalf("Instruction.Type = %q, want %q", result.PaymentInstruction.Type, pgwtypes.InstructionTypeVA)
	}
	if result.PaymentInstruction.VirtualAccountNumber == nil || *result.PaymentInstruction.VirtualAccountNumber != "7007000012345678" {
		t.Fatalf("Instruction.VirtualAccountNumber = %#v, want payment number", result.PaymentInstruction.VirtualAccountNumber)
	}
}

func TestIPaymuParseWebhookJSON(t *testing.T) {
	t.Parallel()

	adapter := NewIPaymuAdapter()
	providerConfig, _ := json.Marshal(IPaymuProviderConfig{VA: "1179000000"})
	bodyWithoutSig := map[string]any{
		"trx_id":       "TRX-123",
		"reference_id": "payment-123",
		"status_code":  1,
		"status":       "success",
		"payment_no":   "7007000012345678",
	}
	sig, err := ipaymuCallbackSignature(bodyWithoutSig, "1179000000")
	if err != nil {
		t.Fatalf("ipaymuCallbackSignature() error = %v", err)
	}
	bodyWithoutSig["signature"] = sig
	body, _ := json.Marshal(bodyWithoutSig)

	event, err := adapter.ParseWebhook(context.Background(), body, nil, providerConfig, nil)
	if err != nil {
		t.Fatalf("ParseWebhook() error = %v", err)
	}
	if event.GatewayTransactionID != "TRX-123" {
		t.Fatalf("GatewayTransactionID = %q, want %q", event.GatewayTransactionID, "TRX-123")
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
