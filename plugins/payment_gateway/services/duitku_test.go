package services

import (
	"context"
	"encoding/json"
	"testing"

	"go_framework/plugins/payment_gateway/pgwtypes"
)

func TestDuitkuParseCreatePaymentResponseVirtualAccount(t *testing.T) {
	t.Parallel()

	adapter := NewDuitkuAdapter()
	rawResp := []byte(`{"merchantCode":"D0001","reference":"REF-123","paymentUrl":"https://sandbox.duitku.com/topup/ref","vaNumber":"7007000012345678","amount":"40000","statusCode":"00","statusMessage":"SUCCESS"}`)
	in := pgwtypes.CreatePaymentInput{
		PaymentID: "payment-123",
		Amount:    40000,
		Currency:  "IDR",
	}
	mc := DuitkuMethodConfig{PaymentMethod: "BC"}

	result, err := adapter.parseCreatePaymentResponse(rawResp, in, mc)
	if err != nil {
		t.Fatalf("parseCreatePaymentResponse() error = %v", err)
	}
	if result.GatewayTransactionID != "REF-123" {
		t.Fatalf("GatewayTransactionID = %q, want %q", result.GatewayTransactionID, "REF-123")
	}
	if result.ProviderTransactionID == nil || *result.ProviderTransactionID != "payment-123" {
		t.Fatalf("ProviderTransactionID = %#v, want payment id", result.ProviderTransactionID)
	}
	if result.ExternalReference == nil || *result.ExternalReference != "7007000012345678" {
		t.Fatalf("ExternalReference = %#v, want va number", result.ExternalReference)
	}
	if result.PaymentInstruction.Type != pgwtypes.InstructionTypeVA {
		t.Fatalf("Instruction.Type = %q, want %q", result.PaymentInstruction.Type, pgwtypes.InstructionTypeVA)
	}
	if result.PaymentInstruction.BankCode == nil || *result.PaymentInstruction.BankCode != "bca" {
		t.Fatalf("Instruction.BankCode = %#v, want bca", result.PaymentInstruction.BankCode)
	}
	if result.PaymentInstruction.VirtualAccountNumber == nil || *result.PaymentInstruction.VirtualAccountNumber != "7007000012345678" {
		t.Fatalf("Instruction.VirtualAccountNumber = %#v, want va", result.PaymentInstruction.VirtualAccountNumber)
	}
}

func TestDuitkuParseWebhook(t *testing.T) {
	t.Parallel()

	adapter := NewDuitkuAdapter()
	providerConfig, _ := json.Marshal(DuitkuProviderConfig{MerchantCode: "D0001"})
	credentials := `{"api_key":"SECRET-KEY"}`
	body := "merchantCode=D0001&amount=40000&merchantOrderId=payment-123&paymentCode=BC&resultCode=00&reference=REF-123&signature=" + duitkuCallbackSignature("D0001", "40000", "payment-123", "SECRET-KEY")

	event, err := adapter.ParseWebhook(context.Background(), []byte(body), nil, providerConfig, &credentials)
	if err != nil {
		t.Fatalf("ParseWebhook() error = %v", err)
	}
	if event.GatewayTransactionID != "REF-123" {
		t.Fatalf("GatewayTransactionID = %q, want %q", event.GatewayTransactionID, "REF-123")
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
