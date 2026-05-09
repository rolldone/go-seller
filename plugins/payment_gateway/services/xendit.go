package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"go_framework/plugins/payment_gateway/pgwtypes"
)

// ─── Config shapes ────────────────────────────────────────────────────────────

// XenditProviderConfig adalah struktur config JSON yang disimpan di payment_providers.config
// untuk provider dengan provider_key = "xendit".
// JANGAN menyimpan secret_key di sini; secret_key ada di credentials_encrypted.
type XenditProviderConfig struct {
	CallbackURL   string `json:"callback_url"`
	WebhookToken  string `json:"webhook_token"`
	IsProduction  bool   `json:"is_production"`
	ForBusinessID string `json:"for_business_id,omitempty"` // Xendit sub-account business ID
}

// XenditCredentials adalah struktur yang disimpan di credentials_encrypted.
type XenditCredentials struct {
	SecretKey string `json:"secret_key"`
}

// XenditMethodConfig adalah config JSON yang disimpan di payment_methods.config
// untuk metode yang terhubung ke Xendit.
type XenditMethodConfig struct {
	// ChannelCode kode saluran Xendit: "BCA", "BNI", "BRI", "MANDIRI", "PERMATA",
	// "OVO", "DANA", "LINKAJA", "SHOPEEPAY", "QRIS"
	ChannelCode string `json:"channel_code"`
	// Type tipe pembayaran: "virtual_account", "ewallet", "qr_code", "retail_outlet"
	Type string `json:"type"`
	// SuggestedAmount jumlah yang disarankan (opsional, untuk ewallet)
	SuggestedAmount *float64 `json:"suggested_amount,omitempty"`
}

// ─── Xendit Adapter ───────────────────────────────────────────────────────────

// XenditAdapter mengimplementasikan pgwtypes.Adapter untuk Xendit.
type XenditAdapter struct {
	httpClient *http.Client
}

// NewXenditAdapter membuat instance baru XenditAdapter.
func NewXenditAdapter() *XenditAdapter {
	return &XenditAdapter{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (a *XenditAdapter) ProviderKey() string {
	return "xendit"
}

func (a *XenditAdapter) CreatePayment(ctx context.Context, in pgwtypes.CreatePaymentInput) (*pgwtypes.CreatePaymentResult, error) {
	cfg, creds, err := a.parseConfigs(in.ProviderConfig, in.CredentialsEncrypted)
	if err != nil {
		return nil, err
	}

	var mc XenditMethodConfig
	if len(in.MethodConfig) > 0 {
		if err := json.Unmarshal(in.MethodConfig, &mc); err != nil {
			return nil, fmt.Errorf("xendit: invalid method config: %w", err)
		}
	}

	switch strings.ToLower(mc.Type) {
	case "virtual_account", "va", "":
		return a.createVA(ctx, in, cfg, creds, mc)
	case "ewallet":
		return a.createEWallet(ctx, in, cfg, creds, mc)
	case "qr_code", "qris":
		return a.createQRCode(ctx, in, cfg, creds, mc)
	default:
		return nil, fmt.Errorf("xendit: unsupported method type %q", mc.Type)
	}
}

// ─── Virtual Account ──────────────────────────────────────────────────────────

func (a *XenditAdapter) createVA(ctx context.Context, in pgwtypes.CreatePaymentInput, cfg XenditProviderConfig, creds XenditCredentials, mc XenditMethodConfig) (*pgwtypes.CreatePaymentResult, error) {
	channelCode := strings.ToUpper(mc.ChannelCode)
	if channelCode == "" {
		channelCode = "BCA"
	}

	expirationDate := time.Now().Add(24 * time.Hour)
	if in.ExpiredAt != nil {
		expirationDate = *in.ExpiredAt
	}

	reqBody := map[string]any{
		"external_id":     in.PaymentID,
		"bank_code":       channelCode,
		"name":            in.CustomerName,
		"expected_amount": int64(in.Amount),
		"expiration_date": expirationDate.UTC().Format(time.RFC3339),
		"is_single_use":   true,
		"is_closed":       true,
	}
	if in.CustomerEmail != "" {
		reqBody["email"] = in.CustomerEmail
	}

	rawResp, err := a.callXendit(ctx, http.MethodPost, "https://api.xendit.co/callback_virtual_accounts", creds.SecretKey, cfg.ForBusinessID, reqBody)
	if err != nil {
		return nil, err
	}

	var resp xenditVAResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("xendit: failed to parse VA response: %w", err)
	}
	if resp.Status == "FAILED" {
		return nil, fmt.Errorf("xendit: VA creation failed: %s", resp.Message)
	}

	vaNum := resp.AccountNumber
	bankLower := strings.ToLower(channelCode)

	instr := pgwtypes.PaymentInstruction{
		Type:                 pgwtypes.InstructionTypeVA,
		DisplayName:          channelCode + " Virtual Account",
		VirtualAccountNumber: &vaNum,
		BankCode:             &bankLower,
		Amount:               in.Amount,
		Currency:             in.Currency,
		ExpiredAt:            in.ExpiredAt,
	}

	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID:  resp.ID,
		ProviderTransactionID: &resp.ExternalID,
		ExternalReference:     &vaNum,
		PaymentInstruction:    instr.Normalize(),
		RawResponse:           rawResp,
		InitialStatus:         pgwtypes.PaymentStatusPending,
	}
	if in.ExpiredAt != nil {
		result.ExpiredAt = in.ExpiredAt
	}
	return result, nil
}

// ─── E-Wallet ─────────────────────────────────────────────────────────────────

func (a *XenditAdapter) createEWallet(ctx context.Context, in pgwtypes.CreatePaymentInput, cfg XenditProviderConfig, creds XenditCredentials, mc XenditMethodConfig) (*pgwtypes.CreatePaymentResult, error) {
	channelCode := strings.ToUpper(mc.ChannelCode)

	reqBody := map[string]any{
		"reference_id":    in.PaymentID,
		"currency":        in.Currency,
		"amount":          in.Amount,
		"checkout_method": "ONE_TIME_PAYMENT",
		"channel_code":    channelCode,
		"channel_properties": map[string]any{
			"success_redirect_url": cfg.CallbackURL,
		},
	}
	if in.CustomerPhone != "" {
		reqBody["channel_properties"].(map[string]any)["mobile_number"] = in.CustomerPhone
	}

	rawResp, err := a.callXendit(ctx, http.MethodPost, "https://api.xendit.co/ewallets/charges", creds.SecretKey, cfg.ForBusinessID, reqBody)
	if err != nil {
		return nil, err
	}

	var resp xenditEWalletResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("xendit: failed to parse ewallet response: %w", err)
	}
	if resp.Status == "FAILED" {
		return nil, fmt.Errorf("xendit: ewallet charge failed: %s", resp.ErrorCode)
	}

	instr := pgwtypes.PaymentInstruction{
		Type:        pgwtypes.InstructionTypeEWallet,
		DisplayName: channelCode,
		Amount:      in.Amount,
		Currency:    in.Currency,
	}
	if resp.Actions.DesktopWebCheckoutURL != "" {
		instr.RedirectURL = &resp.Actions.DesktopWebCheckoutURL
	} else if resp.Actions.MobileWebCheckoutURL != "" {
		instr.RedirectURL = &resp.Actions.MobileWebCheckoutURL
	} else if resp.Actions.MobileDeeplinkCheckoutURL != "" {
		instr.RedirectURL = &resp.Actions.MobileDeeplinkCheckoutURL
	}

	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID:  resp.ID,
		ProviderTransactionID: &resp.ReferenceID,
		PaymentInstruction:    instr.Normalize(),
		RawResponse:           rawResp,
		InitialStatus:         pgwtypes.PaymentStatusPending,
	}
	if instr.RedirectURL != nil {
		result.ExternalReference = instr.RedirectURL
	}
	return result, nil
}

// ─── QR Code ──────────────────────────────────────────────────────────────────

func (a *XenditAdapter) createQRCode(ctx context.Context, in pgwtypes.CreatePaymentInput, cfg XenditProviderConfig, creds XenditCredentials, mc XenditMethodConfig) (*pgwtypes.CreatePaymentResult, error) {
	reqBody := map[string]any{
		"reference_id": in.PaymentID,
		"type":         "DYNAMIC",
		"currency":     in.Currency,
		"amount":       in.Amount,
	}
	if in.ExpiredAt != nil {
		reqBody["expires_at"] = in.ExpiredAt.UTC().Format(time.RFC3339)
	}

	rawResp, err := a.callXendit(ctx, http.MethodPost, "https://api.xendit.co/qr_codes", creds.SecretKey, cfg.ForBusinessID, reqBody)
	if err != nil {
		return nil, err
	}

	var resp xenditQRResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("xendit: failed to parse QR response: %w", err)
	}
	if resp.Status == "FAILED" {
		return nil, fmt.Errorf("xendit: QR creation failed: %s", resp.ErrorCode)
	}

	instr := pgwtypes.PaymentInstruction{
		Type:        pgwtypes.InstructionTypeQris,
		DisplayName: "QRIS",
		QRString:    &resp.QRString,
		Amount:      in.Amount,
		Currency:    in.Currency,
		ExpiredAt:   in.ExpiredAt,
	}

	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID:  resp.ID,
		ProviderTransactionID: &resp.ReferenceID,
		ExternalReference:     &resp.QRString,
		PaymentInstruction:    instr.Normalize(),
		RawResponse:           rawResp,
		InitialStatus:         pgwtypes.PaymentStatusPending,
		ExpiredAt:             in.ExpiredAt,
	}
	return result, nil
}

// ParseWebhook memverifikasi dan mem-parse payload webhook dari Xendit.
// Xendit menggunakan header x-callback-token untuk autentikasi.
func (a *XenditAdapter) ParseWebhook(
	ctx context.Context,
	rawBody []byte,
	headers map[string]string,
	providerConfig json.RawMessage,
	credentialsEncrypted *string,
) (*pgwtypes.WebhookEvent, error) {
	var cfg XenditProviderConfig
	if len(providerConfig) > 0 {
		if err := json.Unmarshal(providerConfig, &cfg); err != nil {
			return nil, fmt.Errorf("xendit: invalid provider config: %w", err)
		}
	}

	// Verifikasi callback token
	callbackToken := headers["x-callback-token"]
	signatureValid := cfg.WebhookToken != "" && callbackToken == cfg.WebhookToken

	// Parse payload — Xendit punya beberapa format tergantung tipe event
	var generic map[string]json.RawMessage
	if err := json.Unmarshal(rawBody, &generic); err != nil {
		return nil, fmt.Errorf("xendit: failed to parse webhook payload: %w", err)
	}

	event := &pgwtypes.WebhookEvent{
		RawPayload:     rawBody,
		SignatureValid: signatureValid,
	}

	// Coba parse berdasarkan field yang ada
	if idRaw, ok := generic["id"]; ok {
		var id string
		json.Unmarshal(idRaw, &id)
		event.GatewayTransactionID = id
		event.IdempotencyKey = &id
	}

	// Ekstrak external_id / reference_id sebagai ProviderTransactionID
	for _, fieldName := range []string{"external_id", "reference_id"} {
		if raw, ok := generic[fieldName]; ok {
			var val string
			if json.Unmarshal(raw, &val) == nil && val != "" {
				event.ProviderTransactionID = &val
				break
			}
		}
	}

	// Tentukan status dari berbagai format event Xendit
	event.Status, event.EventType = a.parseXenditStatus(generic)

	// Ekstrak paid_at / settlement_at
	for _, fieldName := range []string{"paid_at", "settlement_timestamp", "updated"} {
		if raw, ok := generic[fieldName]; ok {
			var ts string
			if json.Unmarshal(raw, &ts) == nil && ts != "" {
				if t, err := time.Parse(time.RFC3339, ts); err == nil {
					if event.Status == "succeeded" {
						event.PaidAt = &t
					}
					break
				}
			}
		}
	}

	return event, nil
}

// parseXenditStatus mengekstrak status dari payload webhook Xendit.
func (a *XenditAdapter) parseXenditStatus(generic map[string]json.RawMessage) (status, eventType string) {
	// VA Payment: field "payment_status" atau "status" = "PAID" / "PENDING"
	for _, fieldName := range []string{"payment_status", "status"} {
		if raw, ok := generic[fieldName]; ok {
			var s string
			if json.Unmarshal(raw, &s) == nil {
				switch strings.ToUpper(s) {
				case "PAID", "SETTLED", "COMPLETED", "SUCCEEDED", "CAPTURED":
					return pgwtypes.PaymentStatusSucceeded, strings.ToLower(s)
				case "FAILED", "VOIDED", "EXPIRED":
					return pgwtypes.PaymentStatusFailed, strings.ToLower(s)
				default:
					return pgwtypes.CanonicalGatewayStatus(s), strings.ToLower(s)
				}
			}
		}
	}
	// EWallet v2: field "charge_status"
	if raw, ok := generic["charge_status"]; ok {
		var s string
		if json.Unmarshal(raw, &s) == nil {
			switch strings.ToUpper(s) {
			case "SUCCEEDED":
				return pgwtypes.PaymentStatusSucceeded, "charge.succeeded"
			case "FAILED":
				return pgwtypes.PaymentStatusFailed, "charge.failed"
			}
		}
	}
	return pgwtypes.PaymentStatusPending, "unknown"
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func (a *XenditAdapter) parseConfigs(providerConfig json.RawMessage, credentialsEncrypted *string) (XenditProviderConfig, XenditCredentials, error) {
	var cfg XenditProviderConfig
	if len(providerConfig) > 0 {
		if err := json.Unmarshal(providerConfig, &cfg); err != nil {
			return cfg, XenditCredentials{}, fmt.Errorf("xendit: invalid provider config: %w", err)
		}
	}

	var creds XenditCredentials
	if credentialsEncrypted != nil && *credentialsEncrypted != "" {
		if err := json.Unmarshal([]byte(*credentialsEncrypted), &creds); err != nil {
			return cfg, creds, fmt.Errorf("xendit: invalid credentials: %w", err)
		}
	}
	if creds.SecretKey == "" {
		return cfg, creds, fmt.Errorf("xendit: secret_key is required in credentials_encrypted")
	}
	return cfg, creds, nil
}

func (a *XenditAdapter) callXendit(ctx context.Context, method, url, secretKey, forBusinessID string, body any) ([]byte, error) {
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("xendit: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, fmt.Errorf("xendit: create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.SetBasicAuth(secretKey, "")
	if forBusinessID != "" {
		req.Header.Set("for-user-id", forBusinessID)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("xendit: http error: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("xendit: read response: %w", err)
	}
	if len(raw) > 0 {
		preview := string(raw)
		if len(preview) > 2048 {
			preview = preview[:2048] + "..."
		}
		log.Printf("[xendit] %s %s status=%d body=%s", method, url, resp.StatusCode, preview)
	} else {
		log.Printf("[xendit] %s %s status=%d body=<empty>", method, url, resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("xendit: http status %d", resp.StatusCode)
	}
	return raw, nil
}

// ─── API response shapes ──────────────────────────────────────────────────────

type xenditVAResponse struct {
	ID            string `json:"id"`
	ExternalID    string `json:"external_id"`
	AccountNumber string `json:"account_number"`
	BankCode      string `json:"bank_code"`
	Status        string `json:"status"`
	Message       string `json:"message"`
}

type xenditEWalletResponse struct {
	ID          string `json:"id"`
	ReferenceID string `json:"reference_id"`
	Status      string `json:"status"`
	ErrorCode   string `json:"error_code"`
	Actions     struct {
		DesktopWebCheckoutURL     string `json:"desktop_web_checkout_url"`
		MobileWebCheckoutURL      string `json:"mobile_web_checkout_url"`
		MobileDeeplinkCheckoutURL string `json:"mobile_deeplink_checkout_url"`
		QRCheckoutString          string `json:"qr_checkout_string"`
	} `json:"actions"`
}

type xenditQRResponse struct {
	ID          string `json:"id"`
	ReferenceID string `json:"reference_id"`
	Status      string `json:"status"`
	QRString    string `json:"qr_string"`
	ErrorCode   string `json:"error_code"`
}
