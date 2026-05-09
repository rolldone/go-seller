package pgwtypes

import "testing"

func TestNormalizeInstructionType(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"virtual_account":     InstructionTypeVA,
		"qr_code":             InstructionTypeQris,
		"e_wallet":            InstructionTypeEWallet,
		"convenience_store":   InstructionTypeCStore,
		"  cstore  ":          InstructionTypeCStore,
		"custom_gateway_type": "custom_gateway_type",
	}

	for input, expected := range tests {
		if got := NormalizeInstructionType(input); got != expected {
			t.Fatalf("NormalizeInstructionType(%q) = %q, want %q", input, got, expected)
		}
	}
}

func TestPaymentInstructionNormalize(t *testing.T) {
	t.Parallel()

	va := " 1234567890 "
	bank := " BCA "
	qr := "  qr-data  "
	redirect := " https://example.test/pay "
	instr := PaymentInstruction{
		Type:                 "virtual_account",
		DisplayName:          "",
		VirtualAccountNumber: &va,
		BankCode:             &bank,
		QRString:             &qr,
		RedirectURL:          &redirect,
		Amount:               150000,
		Currency:             " idr ",
		Steps:                []string{"  step one  ", "", "step one", "step two"},
		ExtraInfo:            map[string]any{"payment_code": "ABC123"},
	}

	got := instr.Normalize()
	if got.Type != InstructionTypeVA {
		t.Fatalf("Type = %q, want %q", got.Type, InstructionTypeVA)
	}
	if got.DisplayName != "Virtual Account" {
		t.Fatalf("DisplayName = %q, want %q", got.DisplayName, "Virtual Account")
	}
	if got.VirtualAccountNumber == nil || *got.VirtualAccountNumber != "1234567890" {
		t.Fatalf("VirtualAccountNumber = %#v, want trimmed value", got.VirtualAccountNumber)
	}
	if got.BankCode == nil || *got.BankCode != "bca" {
		t.Fatalf("BankCode = %#v, want lowercased value", got.BankCode)
	}
	if got.QRString == nil || *got.QRString != "qr-data" {
		t.Fatalf("QRString = %#v, want trimmed value", got.QRString)
	}
	if got.RedirectURL == nil || *got.RedirectURL != "https://example.test/pay" {
		t.Fatalf("RedirectURL = %#v, want trimmed value", got.RedirectURL)
	}
	if got.Currency != "IDR" {
		t.Fatalf("Currency = %q, want %q", got.Currency, "IDR")
	}
	if len(got.Steps) != 2 || got.Steps[0] != "step one" || got.Steps[1] != "step two" {
		t.Fatalf("Steps = %#v, want deduplicated trimmed values", got.Steps)
	}
	if got.ExtraInfo == nil || got.ExtraInfo["payment_code"] != "ABC123" {
		t.Fatalf("ExtraInfo = %#v, want populated metadata to survive normalization", got.ExtraInfo)
	}
}

func TestWebhookEventLookupKeys(t *testing.T) {
	t.Parallel()

	provider := " provider-order-1 "
	external := " qr-123 "
	idempotency := " payment-abc "
	event := WebhookEvent{
		GatewayTransactionID:  " gateway-xyz ",
		ProviderTransactionID: &provider,
		ExternalReference:     &external,
		IdempotencyKey:        &idempotency,
	}

	got := event.LookupKeys()
	want := []string{"gateway-xyz", "provider-order-1", "qr-123", "payment-abc"}
	if len(got) != len(want) {
		t.Fatalf("LookupKeys() len = %d, want %d; got=%#v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("LookupKeys()[%d] = %q, want %q (full=%#v)", i, got[i], want[i], got)
		}
	}
}

func TestCanonicalGatewayStatus(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"settlement":     PaymentStatusSucceeded,
		"capture":        PaymentStatusSucceeded,
		"expired":        PaymentStatusFailed,
		"partial_refund": PaymentStatusRefunded,
		"authorized":     PaymentStatusPending,
		"unknown-status": PaymentStatusPending,
		"":               PaymentStatusPending,
	}

	for input, expected := range tests {
		if got := CanonicalGatewayStatus(input); got != expected {
			t.Fatalf("CanonicalGatewayStatus(%q) = %q, want %q", input, got, expected)
		}
	}
}
