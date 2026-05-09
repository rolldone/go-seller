package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"go_framework/internal/secrets"
	"go_framework/plugins/payment_gateway/pgwtypes"
)

type TripayProviderConfig struct {
	MerchantCode string `json:"merchant_code"`
	CallbackURL  string `json:"callback_url"`
	ReturnURL    string `json:"return_url"`
	IsProduction bool   `json:"is_production"`
}

type TripayCredentials struct {
	APIKey     string `json:"api_key"`
	PrivateKey string `json:"private_key"`
}

type TripayMethodConfig struct {
	Method string `json:"method"`
}

type TripayAdapter struct {
	httpClient *http.Client
}

func NewTripayAdapter() *TripayAdapter {
	return &TripayAdapter{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

func (a *TripayAdapter) ProviderKey() string {
	return "tripay"
}

func (a *TripayAdapter) CreatePayment(ctx context.Context, in pgwtypes.CreatePaymentInput) (*pgwtypes.CreatePaymentResult, error) {
	cfg, creds, err := a.parseConfigs(in.ProviderConfig, in.CredentialsEncrypted)
	if err != nil {
		return nil, err
	}

	var mc TripayMethodConfig
	if len(in.MethodConfig) > 0 {
		if err := json.Unmarshal(in.MethodConfig, &mc); err != nil {
			return nil, fmt.Errorf("tripay: invalid method config: %w", err)
		}
	}
	method := strings.ToUpper(strings.TrimSpace(mc.Method))
	if method == "" {
		method = "BRIVA"
	}

	amount := int64(math.Round(in.Amount))
	if amount <= 0 {
		return nil, fmt.Errorf("tripay: amount must be greater than zero")
	}

	payload := map[string]any{
		"method":         method,
		"merchant_ref":   strings.TrimSpace(in.PaymentID),
		"amount":         amount,
		"customer_name":  tripayCustomerName(in),
		"customer_email": strings.TrimSpace(in.CustomerEmail),
		"customer_phone": strings.TrimSpace(in.CustomerPhone),
		"order_items": []map[string]any{
			{
				"sku":      strings.TrimSpace(in.OrderID),
				"name":     tripayProductName(in.Metadata),
				"price":    amount,
				"quantity": 1,
			},
		},
		"signature": tripayCreateSignature(cfg.MerchantCode, strings.TrimSpace(in.PaymentID), amount, creds.PrivateKey),
	}
	if strings.TrimSpace(cfg.ReturnURL) != "" {
		payload["return_url"] = strings.TrimSpace(cfg.ReturnURL)
	}
	if strings.TrimSpace(cfg.CallbackURL) != "" {
		payload["callback_url"] = strings.TrimSpace(cfg.CallbackURL)
	}
	if in.ExpiredAt != nil {
		expiredUnix := in.ExpiredAt.Unix()
		if expiredUnix > time.Now().Unix() {
			payload["expired_time"] = expiredUnix
		}
	}

	rawResp, err := a.callTripay(ctx, http.MethodPost, tripayBaseURL(cfg.IsProduction)+"transaction/create", creds.APIKey, payload)
	if err != nil {
		return nil, err
	}

	return a.parseCreatePaymentResponse(rawResp, in, method)
}

func (a *TripayAdapter) ParseWebhook(ctx context.Context, rawBody []byte, headers map[string]string, providerConfig json.RawMessage, credentialsEncrypted *string) (*pgwtypes.WebhookEvent, error) {
	_ = ctx

	eventPayload := tripayCallbackEvent{}
	if err := json.Unmarshal(rawBody, &eventPayload); err != nil {
		return nil, fmt.Errorf("tripay: failed to parse callback payload: %w", err)
	}
	if eventPayload.Reference == "" && eventPayload.Data.Reference != "" {
		eventPayload.Reference = eventPayload.Data.Reference
		eventPayload.MerchantRef = eventPayload.Data.MerchantRef
		eventPayload.Status = eventPayload.Data.Status
		eventPayload.PaymentMethod = eventPayload.Data.PaymentMethod
		eventPayload.PayCode = eventPayload.Data.PayCode
		eventPayload.PaidAt = eventPayload.Data.PaidAt
	}

	if strings.TrimSpace(eventPayload.Reference) == "" && strings.TrimSpace(eventPayload.MerchantRef) == "" {
		return nil, fmt.Errorf("tripay: missing reference and merchant_ref")
	}

	eventType := strings.TrimSpace(headers["x-callback-event"])
	if eventType == "" {
		eventType = "payment_status"
	}

	event := &pgwtypes.WebhookEvent{
		GatewayTransactionID: strings.TrimSpace(eventPayload.Reference),
		RawPayload:           rawBody,
		SignatureValid:       false,
		EventType:            eventType,
		Status:               tripayCanonicalStatus(eventPayload.Status),
	}
	if ref := strings.TrimSpace(eventPayload.MerchantRef); ref != "" {
		event.ProviderTransactionID = &ref
	}
	if code := strings.TrimSpace(eventPayload.PayCode); code != "" {
		event.ExternalReference = &code
	}
	if event.GatewayTransactionID != "" {
		key := event.GatewayTransactionID + ":" + strings.ToUpper(strings.TrimSpace(eventPayload.Status))
		event.IdempotencyKey = &key
	}
	if event.Status == pgwtypes.PaymentStatusSucceeded && eventPayload.PaidAt != "" {
		if paidAt, err := parseTripayTime(eventPayload.PaidAt); err == nil {
			event.PaidAt = &paidAt
		}
	}

	if len(providerConfig) == 0 || credentialsEncrypted == nil || strings.TrimSpace(*credentialsEncrypted) == "" {
		return event, nil
	}

	_, creds, err := a.parseConfigs(providerConfig, credentialsEncrypted)
	if err != nil {
		return nil, err
	}
	incomingSig := strings.TrimSpace(headers["x-callback-signature"])
	if incomingSig == "" {
		return event, nil
	}
	localSig := tripayWebhookSignature(rawBody, creds.PrivateKey)
	if hmac.Equal([]byte(strings.ToLower(localSig)), []byte(strings.ToLower(incomingSig))) {
		event.SignatureValid = true
	}

	return event, nil
}

func (a *TripayAdapter) parseConfigs(providerConfig json.RawMessage, credentialsEncrypted *string) (TripayProviderConfig, TripayCredentials, error) {
	var cfg TripayProviderConfig
	if len(providerConfig) > 0 {
		if err := json.Unmarshal(providerConfig, &cfg); err != nil {
			return cfg, TripayCredentials{}, fmt.Errorf("tripay: invalid provider config: %w", err)
		}
	}
	if strings.TrimSpace(cfg.MerchantCode) == "" {
		return cfg, TripayCredentials{}, fmt.Errorf("tripay: merchant_code is required in provider config")
	}

	var creds TripayCredentials
	if credentialsEncrypted != nil && strings.TrimSpace(*credentialsEncrypted) != "" {
		plain, err := secrets.DecryptBlob(*credentialsEncrypted)
		if err != nil {
			return cfg, creds, fmt.Errorf("tripay: invalid credentials: %w", err)
		}
		if err := json.Unmarshal(plain, &creds); err != nil {
			return cfg, creds, fmt.Errorf("tripay: invalid credentials: %w", err)
		}
	}
	if strings.TrimSpace(creds.APIKey) == "" {
		return cfg, creds, fmt.Errorf("tripay: api_key is required in credentials_encrypted")
	}
	if strings.TrimSpace(creds.PrivateKey) == "" {
		return cfg, creds, fmt.Errorf("tripay: private_key is required in credentials_encrypted")
	}

	return cfg, creds, nil
}

func (a *TripayAdapter) callTripay(ctx context.Context, method, endpoint, apiKey string, payload map[string]any) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("tripay: failed to encode request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("tripay: create request error: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tripay: http error: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("tripay: read response error: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("tripay: http status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	return raw, nil
}

func (a *TripayAdapter) parseCreatePaymentResponse(rawResp []byte, in pgwtypes.CreatePaymentInput, method string) (*pgwtypes.CreatePaymentResult, error) {
	var resp tripayCreateResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("tripay: failed to parse create transaction response: %w", err)
	}
	if !resp.Success {
		message := strings.TrimSpace(resp.Message)
		if message == "" {
			message = "create transaction failed"
		}
		return nil, fmt.Errorf("tripay: %s", message)
	}
	if strings.TrimSpace(resp.Data.Reference) == "" {
		return nil, fmt.Errorf("tripay: missing reference in response")
	}

	instruction := tripayInstructionFromResponse(resp.Data, in, method)
	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID: resp.Data.Reference,
		PaymentInstruction:   instruction.Normalize(),
		RawResponse:          rawResp,
		InitialStatus:        pgwtypes.PaymentStatusPending,
	}
	if ref := strings.TrimSpace(resp.Data.MerchantRef); ref != "" {
		result.ProviderTransactionID = &ref
	}
	if ref := strings.TrimSpace(resp.Data.PayCode); ref != "" {
		result.ExternalReference = &ref
	} else if ref := strings.TrimSpace(resp.Data.QRString); ref != "" {
		result.ExternalReference = &ref
	} else if ref := strings.TrimSpace(resp.Data.CheckoutURL); ref != "" {
		result.ExternalReference = &ref
	}
	if resp.Data.ExpiredTime > 0 {
		expiredAt := time.Unix(resp.Data.ExpiredTime, 0)
		result.ExpiredAt = &expiredAt
	}

	return result, nil
}

func tripayCreateSignature(merchantCode, merchantRef string, amount int64, privateKey string) string {
	mac := hmac.New(sha256.New, []byte(privateKey))
	mac.Write([]byte(merchantCode + merchantRef + fmt.Sprintf("%d", amount)))
	return hex.EncodeToString(mac.Sum(nil))
}

func tripayWebhookSignature(rawBody []byte, privateKey string) string {
	mac := hmac.New(sha256.New, []byte(privateKey))
	mac.Write(rawBody)
	return hex.EncodeToString(mac.Sum(nil))
}

func tripayBaseURL(isProduction bool) string {
	if isProduction {
		return "https://tripay.co.id/api/"
	}
	return "https://tripay.co.id/api-sandbox/"
}

func tripayCanonicalStatus(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "PAID", "SUCCESS", "SETTLED":
		return pgwtypes.PaymentStatusSucceeded
	case "EXPIRED", "FAILED", "ERROR", "CANCELED", "CANCELLED":
		return pgwtypes.PaymentStatusFailed
	case "REFUND", "REFUNDED":
		return pgwtypes.PaymentStatusRefunded
	default:
		return pgwtypes.PaymentStatusPending
	}
}

func tripayInstructionFromResponse(data tripayCreateResponseData, in pgwtypes.CreatePaymentInput, method string) pgwtypes.PaymentInstruction {
	instructionType, displayName, bankCode := tripayInstructionMeta(method)
	instruction := pgwtypes.PaymentInstruction{
		Type:        instructionType,
		DisplayName: fallbackString(strings.TrimSpace(data.PaymentName), displayName),
		Amount:      in.Amount,
		Currency:    in.Currency,
	}
	if bankCode != "" {
		instruction.BankCode = &bankCode
	}
	if payCode := strings.TrimSpace(data.PayCode); payCode != "" {
		if instruction.Type == pgwtypes.InstructionTypeVA {
			instruction.VirtualAccountNumber = &payCode
		} else {
			if instruction.ExtraInfo == nil {
				instruction.ExtraInfo = map[string]any{}
			}
			instruction.ExtraInfo["pay_code"] = payCode
		}
	}
	if qr := strings.TrimSpace(data.QRString); qr != "" {
		instruction.QRString = &qr
		instruction.Type = pgwtypes.InstructionTypeQris
	}
	if redirect := strings.TrimSpace(data.CheckoutURL); redirect != "" {
		if instruction.Type == "" {
			instruction.Type = pgwtypes.InstructionTypeRedirect
		}
		instruction.RedirectURL = &redirect
	}
	if data.ExpiredTime > 0 {
		expiredAt := time.Unix(data.ExpiredTime, 0)
		instruction.ExpiredAt = &expiredAt
	}
	if steps := tripayNormalizeInstructions(data.Instructions); len(steps) > 0 {
		instruction.Steps = steps
	}
	return instruction
}

func tripayNormalizeInstructions(instructions []tripayInstructionStep) []string {
	steps := make([]string, 0)
	for _, ins := range instructions {
		title := strings.TrimSpace(ins.Title)
		for _, step := range ins.Steps {
			st := strings.TrimSpace(step)
			if st == "" {
				continue
			}
			if title != "" {
				steps = append(steps, title+": "+st)
			} else {
				steps = append(steps, st)
			}
		}
	}
	if len(steps) == 0 {
		return nil
	}
	return steps
}

func tripayInstructionMeta(method string) (instructionType, displayName, bankCode string) {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "PERMATAVA":
		return pgwtypes.InstructionTypeVA, "Permata Virtual Account", "permata"
	case "BNIVA":
		return pgwtypes.InstructionTypeVA, "BNI Virtual Account", "bni"
	case "BRIVA":
		return pgwtypes.InstructionTypeVA, "BRI Virtual Account", "bri"
	case "MANDIRIVA":
		return pgwtypes.InstructionTypeVA, "Mandiri Virtual Account", "mandiri"
	case "BCAVA":
		return pgwtypes.InstructionTypeVA, "BCA Virtual Account", "bca"
	case "MUAMALATVA":
		return pgwtypes.InstructionTypeVA, "Muamalat Virtual Account", "muamalat"
	case "CIMBVA":
		return pgwtypes.InstructionTypeVA, "CIMB Virtual Account", "cimb"
	case "BSIVA":
		return pgwtypes.InstructionTypeVA, "BSI Virtual Account", "bsi"
	case "OCBCVA":
		return pgwtypes.InstructionTypeVA, "OCBC Virtual Account", "ocbc"
	case "DANAMONVA":
		return pgwtypes.InstructionTypeVA, "Danamon Virtual Account", "danamon"
	case "ALFAMART":
		return pgwtypes.InstructionTypeCStore, "Alfamart", ""
	case "INDOMARET":
		return pgwtypes.InstructionTypeCStore, "Indomaret", ""
	case "ALFAMIDI":
		return pgwtypes.InstructionTypeCStore, "Alfamidi", ""
	case "QRIS", "QRISC", "QRIS2", "QRIS_SHOPEEPAY":
		return pgwtypes.InstructionTypeQris, "QRIS", ""
	case "OVO":
		return pgwtypes.InstructionTypeEWallet, "OVO", ""
	case "DANA":
		return pgwtypes.InstructionTypeEWallet, "DANA", ""
	case "SHOPEEPAY":
		return pgwtypes.InstructionTypeEWallet, "ShopeePay", ""
	default:
		return pgwtypes.InstructionTypeRedirect, "Tripay", ""
	}
}

func tripayCustomerName(in pgwtypes.CreatePaymentInput) string {
	if name := strings.TrimSpace(in.CustomerName); name != "" {
		return name
	}
	if email := strings.TrimSpace(in.CustomerEmail); email != "" {
		return email
	}
	return "Customer"
}

func tripayProductName(metadata map[string]any) string {
	if metadata != nil {
		if val, ok := metadata["product_name"].(string); ok && strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val)
		}
		if val, ok := metadata["product_details"].(string); ok && strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val)
		}
	}
	return "Payment"
}

func parseTripayTime(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, fmt.Errorf("empty time")
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05-0700"} {
		if t, err := time.Parse(layout, value); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid time format")
}

func fallbackString(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return strings.TrimSpace(fallback)
}

type tripayInstructionStep struct {
	Title string   `json:"title"`
	Steps []string `json:"steps"`
}

type tripayCreateResponseData struct {
	Reference     string                  `json:"reference"`
	MerchantRef   string                  `json:"merchant_ref"`
	PaymentName   string                  `json:"payment_name"`
	PaymentMethod string                  `json:"payment_method"`
	CheckoutURL   string                  `json:"checkout_url"`
	PayCode       string                  `json:"pay_code"`
	QRString      string                  `json:"qr_string"`
	Status        string                  `json:"status"`
	PaidAt        string                  `json:"paid_at"`
	ExpiredTime   int64                   `json:"expired_time"`
	Instructions  []tripayInstructionStep `json:"instructions"`
}

type tripayCreateResponse struct {
	Success bool                     `json:"success"`
	Message string                   `json:"message"`
	Data    tripayCreateResponseData `json:"data"`
}

type tripayCallbackEventData struct {
	Reference     string `json:"reference"`
	MerchantRef   string `json:"merchant_ref"`
	Status        string `json:"status"`
	PaymentMethod string `json:"payment_method"`
	PayCode       string `json:"pay_code"`
	PaidAt        string `json:"paid_at"`
}

type tripayCallbackEvent struct {
	tripayCallbackEventData
	Data tripayCallbackEventData `json:"data"`
}
