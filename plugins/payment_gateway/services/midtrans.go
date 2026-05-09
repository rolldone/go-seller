// Package services berisi implementasi adapter untuk setiap payment gateway.
package services

import (
	"bytes"
	"context"
	"crypto/sha512"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"go_framework/internal/secrets"
	"go_framework/plugins/payment_gateway/pgwtypes"
)

// ─── Config shapes ────────────────────────────────────────────────────────────

// MidtransProviderConfig adalah struktur config JSON yang disimpan di payment_providers.config
// untuk provider dengan provider_key = "midtrans".
// JANGAN menyimpan server_key di sini; server_key ada di credentials_encrypted.
type MidtransProviderConfig struct {
	ClientKey    string `json:"client_key"`
	MerchantID   string `json:"merchant_id"`
	SnapURL      string `json:"snap_url"`
	ChargeURL    string `json:"charge_url"`
	StatusURL    string `json:"status_url"`
	IsProduction bool   `json:"is_production"`
}

// MidtransCredentials adalah struktur yang disimpan di credentials_encrypted.
type MidtransCredentials struct {
	ServerKey string `json:"server_key"`
}

// MidtransMethodConfig adalah config JSON yang disimpan di payment_methods.config
// untuk metode yang terhubung ke Midtrans. Misal: {"bank": "bca"} untuk VA BCA.
type MidtransMethodConfig struct {
	// Bank digunakan untuk bank_transfer, misal "bca", "bni", "mandiri", "permata"
	Bank string `json:"bank"`
	// ChargeType tipe charge: "bank_transfer" | "cstore" | "gopay" | "shopeepay" dll
	ChargeType string `json:"charge_type"`
	// BillerCode untuk Mandiri Bill Payment
	BillerCode *string `json:"biller_code,omitempty"`
	// CompanyCode untuk Mandiri Bill Payment
	CompanyCode *string `json:"company_code,omitempty"`
}

// ─── Midtrans Adapter ────────────────────────────────────────────────────────

// MidtransAdapter mengimplementasikan pgwtypes.Adapter untuk Midtrans.
type MidtransAdapter struct {
	httpClient *http.Client
}

// NewMidtransAdapter membuat instance baru MidtransAdapter.
func NewMidtransAdapter() *MidtransAdapter {
	return &MidtransAdapter{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (a *MidtransAdapter) ProviderKey() string {
	return "midtrans"
}

func (a *MidtransAdapter) CreatePayment(ctx context.Context, in pgwtypes.CreatePaymentInput) (*pgwtypes.CreatePaymentResult, error) {
	cfg, creds, err := a.parseConfigs(in.ProviderConfig, in.CredentialsEncrypted)
	if err != nil {
		return nil, err
	}

	var methodCfg MidtransMethodConfig
	if len(in.MethodConfig) > 0 {
		if err := json.Unmarshal(in.MethodConfig, &methodCfg); err != nil {
			return nil, fmt.Errorf("midtrans: invalid method config: %w", err)
		}
	}
	if methodCfg.ChargeType == "" {
		methodCfg.ChargeType = "bank_transfer"
	}

	// Explicitly check for direct/native mode
	if in.Mode == "native" || isMidtransNativeChargeType(methodCfg.ChargeType) {
		return a.createNativePayment(ctx, in, cfg, creds)
	}

	chargeURL := cfg.ChargeURL
	if chargeURL == "" {
		if cfg.IsProduction {
			chargeURL = "https://api.midtrans.com/v2/charge"
		} else {
			chargeURL = "https://api.sandbox.midtrans.com/v2/charge"
		}
	}

	// Build charge request body sesuai tipe
	reqBody, err := a.buildChargeBody(in, methodCfg)
	if err != nil {
		return nil, err
	}

	rawResp, err := a.callMidtrans(ctx, http.MethodPost, chargeURL, creds.ServerKey, reqBody)
	if err != nil {
		return nil, err
	}

	return a.parseChargeResponse(rawResp, in, methodCfg)
}

func (a *MidtransAdapter) createNativePayment(ctx context.Context, in pgwtypes.CreatePaymentInput, cfg MidtransProviderConfig, creds MidtransCredentials) (*pgwtypes.CreatePaymentResult, error) {
	snapURL := strings.TrimSpace(cfg.SnapURL)
	if snapURL == "" {
		if cfg.IsProduction {
			snapURL = "https://app.midtrans.com/snap/v1/transactions"
		} else {
			snapURL = "https://app.sandbox.midtrans.com/snap/v1/transactions"
		}
	}

	reqBody, err := a.buildNativeBody(in)
	if err != nil {
		return nil, err
	}

	rawResp, err := a.callMidtrans(ctx, http.MethodPost, snapURL, creds.ServerKey, reqBody)
	if err != nil {
		return nil, err
	}

	return a.parseNativeResponse(rawResp, in)
}

func (a *MidtransAdapter) buildNativeBody(in pgwtypes.CreatePaymentInput) ([]byte, error) {
	body := map[string]any{
		"transaction_details": map[string]any{
			"order_id":     in.PaymentID,
			"gross_amount": int64(in.Amount),
		},
		"customer_details": map[string]any{
			"first_name": in.CustomerName,
			"email":      in.CustomerEmail,
			"phone":      in.CustomerPhone,
		},
	}

	if in.ExpiredAt != nil {
		minutes := int(time.Until(*in.ExpiredAt).Minutes())
		if minutes > 0 {
			body["expiry"] = map[string]any{
				"start_time": time.Now().Format("2006-01-02 15:04:05 -0700"),
				"unit":       "minute",
				"duration":   minutes,
			}
		}
	}

	return json.Marshal(body)
}

func (a *MidtransAdapter) parseNativeResponse(rawResp []byte, in pgwtypes.CreatePaymentInput) (*pgwtypes.CreatePaymentResult, error) {
	var resp midtransSnapResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("midtrans: failed to parse native response: %w", err)
	}
	if strings.TrimSpace(resp.RedirectURL) == "" {
		return nil, fmt.Errorf("midtrans: native response missing redirect_url")
	}

	providerTxnID := in.PaymentID
	instr := pgwtypes.PaymentInstruction{
		Type:        pgwtypes.InstructionTypeRedirect,
		DisplayName: "Midtrans",
		RedirectURL: &resp.RedirectURL,
		Amount:      in.Amount,
		Currency:    in.Currency,
	}
	if strings.TrimSpace(resp.Token) != "" {
		instr.ExtraInfo = map[string]any{"snap_token": resp.Token}
	}
	instr = instr.Normalize()

	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID:  in.PaymentID,
		ProviderTransactionID: &providerTxnID,
		ExternalReference:     &resp.RedirectURL,
		PaymentInstruction:    instr,
		RawResponse:           rawResp,
		InitialStatus:         pgwtypes.PaymentStatusPending,
	}
	if in.ExpiredAt != nil {
		result.ExpiredAt = in.ExpiredAt
	}

	return result, nil
}

func isMidtransNativeChargeType(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "native", "snap", "snap_redirect":
		return true
	default:
		return false
	}
}

// buildChargeBody membangun payload JSON untuk Midtrans Charge API.
func (a *MidtransAdapter) buildChargeBody(in pgwtypes.CreatePaymentInput, mc MidtransMethodConfig) ([]byte, error) {
	base := map[string]any{
		"payment_type": mc.ChargeType,
		"transaction_details": map[string]any{
			"order_id":     in.PaymentID, // gunakan PaymentID sebagai idempotency
			"gross_amount": int64(in.Amount),
		},
		"customer_details": map[string]any{
			"first_name": in.CustomerName,
			"email":      in.CustomerEmail,
			"phone":      in.CustomerPhone,
		},
	}

	switch mc.ChargeType {
	case "bank_transfer":
		bank := strings.ToLower(mc.Bank)
		bankTransfer := map[string]any{"bank": bank}
		if bank == "mandiri" {
			// Mandiri Bill Payment butuh biller_code dan bill_key
			if mc.BillerCode != nil {
				bankTransfer["biller_code"] = *mc.BillerCode
				bankTransfer["bill_key"] = in.PaymentID[:12] // truncate ke 12 char
			}
		}
		base["bank_transfer"] = bankTransfer

	case "gopay", "shopeepay", "qris":
		base[mc.ChargeType] = map[string]any{
			"enable_callback": true,
		}

	case "cstore":
		base["cstore"] = map[string]any{
			"store": strings.ToLower(mc.Bank), // "alfamart" or "indomaret"
		}
	}

	if in.ExpiredAt != nil {
		base["custom_expiry"] = map[string]any{
			"expiry_duration": int(time.Until(*in.ExpiredAt).Minutes()),
			"unit":            "minute",
		}
	}

	return json.Marshal(base)
}

// parseChargeResponse mem-parse response dari Midtrans Charge API.
func (a *MidtransAdapter) parseChargeResponse(rawResp []byte, in pgwtypes.CreatePaymentInput, mc MidtransMethodConfig) (*pgwtypes.CreatePaymentResult, error) {
	var resp midtransChargeResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("midtrans: failed to parse charge response: %w", err)
	}
	if resp.StatusCode != "200" && resp.StatusCode != "201" {
		return nil, fmt.Errorf("midtrans: charge failed: %s — %s", resp.StatusCode, resp.StatusMessage)
	}

	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID: resp.TransactionID,
		RawResponse:          rawResp,
		InitialStatus:        pgwtypes.PaymentStatusPending,
	}
	if resp.OrderID != "" {
		result.ProviderTransactionID = &resp.OrderID
	}

	instr := pgwtypes.PaymentInstruction{
		Amount:   in.Amount,
		Currency: in.Currency,
	}

	switch mc.ChargeType {
	case "bank_transfer":
		instr.Type = pgwtypes.InstructionTypeVA
		instr.DisplayName = strings.ToUpper(mc.Bank) + " Virtual Account"
		bank := strings.ToLower(mc.Bank)
		instr.BankCode = &bank
		vaNum := resp.VirtualAccountNumber(mc.Bank)
		if vaNum != "" {
			instr.VirtualAccountNumber = &vaNum
			result.ExternalReference = &vaNum
		}

	case "gopay", "shopeepay":
		instr.Type = pgwtypes.InstructionTypeEWallet
		instr.DisplayName = strings.ToUpper(mc.ChargeType)
		if len(resp.Actions) > 0 {
			for _, act := range resp.Actions {
				if act.Name == "deeplink-redirect" || act.Name == "generate-qr-code" {
					instr.RedirectURL = &act.URL
					result.ExternalReference = &act.URL
					break
				}
			}
		}

	case "qris":
		instr.Type = pgwtypes.InstructionTypeQris
		instr.DisplayName = "QRIS"
		if resp.QRString != "" {
			instr.QRString = &resp.QRString
			result.ExternalReference = &resp.QRString
		}

	case "cstore":
		instr.Type = pgwtypes.InstructionTypeCStore
		instr.DisplayName = strings.ToUpper(mc.Bank)
		if resp.PaymentCode != "" {
			instr.ExtraInfo = map[string]any{"payment_code": resp.PaymentCode}
			result.ExternalReference = &resp.PaymentCode
		}
	}

	if resp.ExpiryTime != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", resp.ExpiryTime); err == nil {
			instr.ExpiredAt = &t
			result.ExpiredAt = &t
		}
	}

	result.PaymentInstruction = instr.Normalize()
	return result, nil
}

// ParseWebhook memverifikasi dan mem-parse payload webhook dari Midtrans.
func (a *MidtransAdapter) ParseWebhook(
	ctx context.Context,
	rawBody []byte,
	headers map[string]string,
	providerConfig json.RawMessage,
	credentialsEncrypted *string,
) (*pgwtypes.WebhookEvent, error) {
	var payload midtransWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, fmt.Errorf("midtrans: failed to parse webhook payload: %w", err)
	}

	signatureValid := false
	if credentialsEncrypted != nil && strings.TrimSpace(*credentialsEncrypted) != "" {
		_, creds, err := a.parseConfigs(providerConfig, credentialsEncrypted)
		if err != nil {
			return nil, err
		}

		// Verifikasi signature: SHA512(order_id + status_code + gross_amount + server_key)
		signatureValid = a.verifyWebhookSignature(payload, creds.ServerKey)
	}

	// Map status Midtrans ke status internal
	status := mapMidtransStatus(payload.TransactionStatus, payload.FraudStatus)

	event := &pgwtypes.WebhookEvent{
		GatewayTransactionID: payload.TransactionID,
		RawPayload:           rawBody,
		SignatureValid:       signatureValid,
		EventType:            payload.TransactionStatus,
		Status:               status,
	}
	if payload.OrderID != "" {
		event.ProviderTransactionID = &payload.OrderID
	}
	if payload.SignatureKey != "" {
		key := payload.TransactionID + ":" + payload.TransactionStatus
		event.IdempotencyKey = &key
	}
	if status == "succeeded" && payload.SettlementTime != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", payload.SettlementTime); err == nil {
			event.PaidAt = &t
		}
	}

	return event, nil
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func (a *MidtransAdapter) parseConfigs(providerConfig json.RawMessage, credentialsEncrypted *string) (MidtransProviderConfig, MidtransCredentials, error) {
	var cfg MidtransProviderConfig
	if len(providerConfig) > 0 {
		if err := json.Unmarshal(providerConfig, &cfg); err != nil {
			return cfg, MidtransCredentials{}, fmt.Errorf("midtrans: invalid provider config: %w", err)
		}
	}

	var creds MidtransCredentials
	if credentialsEncrypted != nil && *credentialsEncrypted != "" {
		// Decrypt if value is an encrypted envelope; DecryptBlob will return
		// plain JSON if the blob is not an envelope.
		plain, err := secrets.DecryptBlob(*credentialsEncrypted)
		if err != nil {
			return cfg, creds, fmt.Errorf("midtrans: invalid credentials: %w", err)
		}
		if err := json.Unmarshal(plain, &creds); err != nil {
			return cfg, creds, fmt.Errorf("midtrans: invalid credentials: %w", err)
		}
	}
	if creds.ServerKey == "" {
		return cfg, creds, fmt.Errorf("midtrans: server_key is required in credentials_encrypted")
	}
	return cfg, creds, nil
}

// callMidtrans melakukan HTTP POST ke Midtrans dengan Basic Auth (server_key:).
func (a *MidtransAdapter) callMidtrans(ctx context.Context, method, url, serverKey string, body []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("midtrans: create request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.SetBasicAuth(serverKey, "")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("midtrans: http error: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("midtrans: read response error: %w", err)
	}
	if len(raw) > 0 {
		preview := string(raw)
		if len(preview) > 2048 {
			preview = preview[:2048] + "..."
		}
		log.Printf("[midtrans] %s %s status=%d body=%s", method, url, resp.StatusCode, preview)
	} else {
		log.Printf("[midtrans] %s %s status=%d body=<empty>", method, url, resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("midtrans: http status %d", resp.StatusCode)
	}
	return raw, nil
}

func (a *MidtransAdapter) verifyWebhookSignature(p midtransWebhookPayload, serverKey string) bool {
	if p.SignatureKey == "" {
		return false
	}
	raw := p.OrderID + p.StatusCode + p.GrossAmount + serverKey
	h := sha512.New()
	h.Write([]byte(raw))
	expected := fmt.Sprintf("%x", h.Sum(nil))
	return expected == p.SignatureKey
}

func mapMidtransStatus(txStatus, fraudStatus string) string {
	switch strings.ToLower(strings.TrimSpace(txStatus)) {
	case "settlement":
		return pgwtypes.PaymentStatusSucceeded
	case "capture":
		if fraudStatus == "" || strings.EqualFold(fraudStatus, "accept") {
			return pgwtypes.PaymentStatusSucceeded
		}
		return pgwtypes.PaymentStatusFailed
	case "cancel", "deny", "expire":
		return pgwtypes.PaymentStatusFailed
	case "refund", "partial_refund":
		return pgwtypes.PaymentStatusRefunded
	default:
		return pgwtypes.CanonicalGatewayStatus(txStatus)
	}
}

// ─── API response shapes ──────────────────────────────────────────────────────

type midtransChargeResponse struct {
	StatusCode        string `json:"status_code"`
	StatusMessage     string `json:"status_message"`
	TransactionID     string `json:"transaction_id"`
	OrderID           string `json:"order_id"`
	GrossAmount       string `json:"gross_amount"`
	Currency          string `json:"currency"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	ExpiryTime        string `json:"expiry_time"`
	QRString          string `json:"qr_string"`
	PaymentCode       string `json:"payment_code"`
	Actions           []struct {
		Name   string `json:"name"`
		Method string `json:"method"`
		URL    string `json:"url"`
	} `json:"actions"`
	VANumbers []struct {
		Bank     string `json:"bank"`
		VANumber string `json:"va_number"`
	} `json:"va_numbers"`
	// Mandiri Bill
	BillerCode string `json:"biller_code"`
	BillKey    string `json:"bill_key"`
}

// VirtualAccountNumber mengambil nomor VA berdasarkan nama bank.
func (r *midtransChargeResponse) VirtualAccountNumber(bank string) string {
	b := strings.ToLower(bank)
	for _, va := range r.VANumbers {
		if strings.ToLower(va.Bank) == b {
			return va.VANumber
		}
	}
	if b == "mandiri" && r.BillKey != "" {
		return r.BillerCode + r.BillKey
	}
	return ""
}

type midtransWebhookPayload struct {
	TransactionID     string `json:"transaction_id"`
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	SignatureKey      string `json:"signature_key"`
	SettlementTime    string `json:"settlement_time"`
	Currency          string `json:"currency"`
}

type midtransSnapResponse struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}
