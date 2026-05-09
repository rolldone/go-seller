package services

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func TestMidtransParseWebhookWithoutCredentials(t *testing.T) {
	adapter := NewMidtransAdapter()
	body := []byte(`{"transaction_id":"TRX-123","order_id":"PAY-123","status_code":"200","gross_amount":"10000","transaction_status":"settlement","fraud_status":"accept"}`)

	event, err := adapter.ParseWebhook(context.Background(), body, nil, nil, nil)
	if err != nil {
		t.Fatalf("ParseWebhook() error = %v", err)
	}
	if event == nil {
		t.Fatal("ParseWebhook() returned nil event")
	}
	if event.SignatureValid {
		t.Fatal("expected signature validation to be skipped without credentials")
	}
	if event.Status != "succeeded" {
		t.Fatalf("unexpected status = %q", event.Status)
	}
	if event.GatewayTransactionID != "TRX-123" {
		t.Fatalf("unexpected gateway transaction id = %q", event.GatewayTransactionID)
	}
	if got := event.LookupKeys(); len(got) < 2 || got[0] != "TRX-123" || got[1] != "PAY-123" {
		t.Fatalf("unexpected lookup keys = %#v", got)
	}
}

func TestMidtransParseWebhookWithCredentials(t *testing.T) {
	adapter := NewMidtransAdapter()
	serverKey := "server-secret"
	orderID := "PAY-456"
	transactionID := "TRX-456"
	statusCode := "200"
	grossAmount := "15000"
	settlementTime := "2026-05-09 02:36:51"

	signatureRaw := orderID + statusCode + grossAmount + serverKey
	h := sha512.New()
	_, _ = h.Write([]byte(signatureRaw))
	signatureKey := hex.EncodeToString(h.Sum(nil))

	body := []byte(fmt.Sprintf(`{"transaction_id":"%s","order_id":"%s","status_code":"%s","gross_amount":"%s","transaction_status":"settlement","fraud_status":"accept","signature_key":"%s","settlement_time":"%s"}`,
		transactionID, orderID, statusCode, grossAmount, signatureKey, settlementTime))

	creds, err := json.Marshal(MidtransCredentials{ServerKey: serverKey})
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}
	credsStr := string(creds)

	event, err := adapter.ParseWebhook(context.Background(), body, nil, nil, &credsStr)
	if err != nil {
		t.Fatalf("ParseWebhook() error = %v", err)
	}
	if event == nil {
		t.Fatal("ParseWebhook() returned nil event")
	}
	if !event.SignatureValid {
		t.Fatal("expected signature to be valid")
	}
	if event.PaidAt == nil {
		t.Fatal("expected paid_at to be populated")
	}
	expectedPaidAt, err := time.Parse("2006-01-02 15:04:05", settlementTime)
	if err != nil {
		t.Fatalf("time.Parse() error = %v", err)
	}
	if !event.PaidAt.Equal(expectedPaidAt) {
		t.Fatalf("unexpected paid_at = %v", event.PaidAt)
	}
}
