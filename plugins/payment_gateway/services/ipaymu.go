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
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"go_framework/internal/secrets"
	"go_framework/plugins/payment_gateway/pgwtypes"
)

type IPaymuProviderConfig struct {
	VA           string `json:"va"`
	CallbackURL  string `json:"callback_url"`
	ReturnURL    string `json:"return_url"`
	SuccessURL   string `json:"success_url"`
	CancelURL    string `json:"cancel_url"`
	IsProduction bool   `json:"is_production"`
}

type IPaymuCredentials struct {
	APIKey string `json:"api_key"`
}

type IPaymuMethodConfig struct {
	PaymentMethod  string `json:"payment_method"`
	PaymentChannel string `json:"payment_channel"`
}

type IPaymuAdapter struct {
	httpClient *http.Client
}

func NewIPaymuAdapter() *IPaymuAdapter {
	return &IPaymuAdapter{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

func (a *IPaymuAdapter) ProviderKey() string {
	return "ipaymu"
}

func (a *IPaymuAdapter) CreatePayment(ctx context.Context, in pgwtypes.CreatePaymentInput) (*pgwtypes.CreatePaymentResult, error) {
	cfg, creds, err := a.parseConfigs(in.ProviderConfig, in.CredentialsEncrypted)
	if err != nil {
		return nil, err
	}

	var mc IPaymuMethodConfig
	if len(in.MethodConfig) > 0 {
		if err := json.Unmarshal(in.MethodConfig, &mc); err != nil {
			return nil, fmt.Errorf("ipaymu: invalid method config: %w", err)
		}
	}
	if strings.TrimSpace(mc.PaymentMethod) == "" {
		mc.PaymentMethod = "va"
	}
	if strings.TrimSpace(mc.PaymentChannel) == "" {
		if strings.EqualFold(mc.PaymentMethod, "va") {
			mc.PaymentChannel = "bca"
		}
	}

	amount := int64(math.Round(in.Amount))
	if amount <= 0 {
		return nil, fmt.Errorf("ipaymu: amount must be greater than zero")
	}

	notifyURL := strings.TrimSpace(cfg.CallbackURL)
	if notifyURL == "" {
		return nil, fmt.Errorf("ipaymu: callback_url is required in provider config")
	}
	successURL := strings.TrimSpace(cfg.SuccessURL)
	if successURL == "" {
		successURL = strings.TrimSpace(cfg.ReturnURL)
	}
	cancelURL := strings.TrimSpace(cfg.CancelURL)
	if cancelURL == "" {
		cancelURL = strings.TrimSpace(cfg.ReturnURL)
	}

	payload := map[string]any{
		"name":           ipaymuCustomerName(in),
		"phone":          ipaymuCustomerPhone(in),
		"email":          ipaymuCustomerEmail(in),
		"amount":         amount,
		"notifyUrl":      notifyURL,
		"referenceId":    strings.TrimSpace(in.PaymentID),
		"paymentMethod":  strings.ToLower(strings.TrimSpace(mc.PaymentMethod)),
		"paymentChannel": strings.ToLower(strings.TrimSpace(mc.PaymentChannel)),
		"comments":       ipaymuProductName(in.Metadata),
	}
	if successURL != "" {
		payload["successUrl"] = successURL
	}
	if cancelURL != "" {
		payload["cancelUrl"] = cancelURL
	}
	if in.ExpiredAt != nil {
		payload["expired"] = in.ExpiredAt.UTC().Format(time.RFC3339)
	}

	rawResp, err := a.callIPaymuDirect(ctx, ipaymuBaseURL(cfg.IsProduction)+"api/v2/payment/direct", cfg.VA, creds.APIKey, payload)
	if err != nil {
		return nil, err
	}

	return a.parseCreatePaymentResponse(rawResp, in, mc)
}

func (a *IPaymuAdapter) ParseWebhook(ctx context.Context, rawBody []byte, headers map[string]string, providerConfig json.RawMessage, credentialsEncrypted *string) (*pgwtypes.WebhookEvent, error) {
	_ = ctx
	_ = credentialsEncrypted

	payloadMap, err := ipaymuParseCallbackBody(rawBody)
	if err != nil {
		return nil, fmt.Errorf("ipaymu: failed to parse callback payload: %w", err)
	}

	trxID := strings.TrimSpace(ipaymuAnyString(payloadMap, "trx_id", "transaction_id", "sid", "session_id"))
	referenceID := strings.TrimSpace(ipaymuAnyString(payloadMap, "reference_id", "referenceId"))
	statusCode := strings.TrimSpace(ipaymuAnyString(payloadMap, "status_code", "statusCode"))
	statusText := strings.TrimSpace(ipaymuAnyString(payloadMap, "status"))
	payCode := strings.TrimSpace(ipaymuAnyString(payloadMap, "payment_no", "pay_code"))
	signature := strings.TrimSpace(ipaymuAnyString(payloadMap, "signature"))

	if trxID == "" && referenceID == "" {
		return nil, fmt.Errorf("ipaymu: missing transaction identifiers")
	}

	event := &pgwtypes.WebhookEvent{
		GatewayTransactionID: trxID,
		RawPayload:           rawBody,
		SignatureValid:       false,
		EventType:            "callback",
		Status:               ipaymuCanonicalStatus(statusCode, statusText),
	}
	if referenceID != "" {
		event.ProviderTransactionID = &referenceID
	}
	if payCode != "" {
		event.ExternalReference = &payCode
	}
	if trxID != "" {
		idKey := trxID + ":" + statusCode
		event.IdempotencyKey = &idKey
	}
	if event.Status == pgwtypes.PaymentStatusSucceeded {
		paidAt := strings.TrimSpace(ipaymuAnyString(payloadMap, "paid_at", "paidAt"))
		if paidAt != "" {
			if t, err := parseTripayTime(paidAt); err == nil {
				event.PaidAt = &t
			}
		}
	}

	if len(providerConfig) == 0 {
		return event, nil
	}
	cfg, _, err := a.parseConfigs(providerConfig, nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.VA) == "" || signature == "" {
		return event, nil
	}
	localSig, err := ipaymuCallbackSignature(payloadMap, cfg.VA)
	if err != nil {
		return nil, err
	}
	if hmac.Equal([]byte(strings.ToLower(localSig)), []byte(strings.ToLower(signature))) {
		event.SignatureValid = true
	}

	if event.GatewayTransactionID == "" && event.ProviderTransactionID != nil {
		event.GatewayTransactionID = strings.TrimSpace(*event.ProviderTransactionID)
	}

	_ = headers
	return event, nil
}

func (a *IPaymuAdapter) parseConfigs(providerConfig json.RawMessage, credentialsEncrypted *string) (IPaymuProviderConfig, IPaymuCredentials, error) {
	var cfg IPaymuProviderConfig
	if len(providerConfig) > 0 {
		if err := json.Unmarshal(providerConfig, &cfg); err != nil {
			return cfg, IPaymuCredentials{}, fmt.Errorf("ipaymu: invalid provider config: %w", err)
		}
	}
	if strings.TrimSpace(cfg.VA) == "" {
		return cfg, IPaymuCredentials{}, fmt.Errorf("ipaymu: va is required in provider config")
	}

	var creds IPaymuCredentials
	if credentialsEncrypted != nil && strings.TrimSpace(*credentialsEncrypted) != "" {
		plain, err := secrets.DecryptBlob(*credentialsEncrypted)
		if err != nil {
			return cfg, creds, fmt.Errorf("ipaymu: invalid credentials: %w", err)
		}
		if err := json.Unmarshal(plain, &creds); err != nil {
			return cfg, creds, fmt.Errorf("ipaymu: invalid credentials: %w", err)
		}
	}
	if credentialsEncrypted != nil && strings.TrimSpace(creds.APIKey) == "" {
		return cfg, creds, fmt.Errorf("ipaymu: api_key is required in credentials_encrypted")
	}

	return cfg, creds, nil
}

func (a *IPaymuAdapter) callIPaymuDirect(ctx context.Context, endpoint, va, apiKey string, payload map[string]any) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("ipaymu: failed to encode request body: %w", err)
	}

	hashedBody := sha256.Sum256(body)
	bodyHex := strings.ToLower(hex.EncodeToString(hashedBody[:]))
	stringToSign := strings.ToUpper(http.MethodPost) + ":" + strings.TrimSpace(va) + ":" + bodyHex + ":" + strings.TrimSpace(apiKey)
	signature := ipaymuHMACHex(stringToSign, strings.TrimSpace(apiKey))
	timestamp := time.Now().In(time.FixedZone("WIB", 7*60*60)).Format("20060102150405")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ipaymu: create request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("va", strings.TrimSpace(va))
	req.Header.Set("signature", signature)
	req.Header.Set("timestamp", timestamp)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ipaymu: http error: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("ipaymu: read response error: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ipaymu: http status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	return raw, nil
}

func (a *IPaymuAdapter) parseCreatePaymentResponse(rawResp []byte, in pgwtypes.CreatePaymentInput, mc IPaymuMethodConfig) (*pgwtypes.CreatePaymentResult, error) {
	var resp ipaymuDirectResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("ipaymu: failed to parse direct payment response: %w", err)
	}
	if resp.Status != 200 && strings.TrimSpace(resp.Data.TransactionID) == "" {
		message := strings.TrimSpace(resp.Message)
		if message == "" {
			message = "create payment failed"
		}
		return nil, fmt.Errorf("ipaymu: %s", message)
	}

	gatewayTxID := strings.TrimSpace(resp.Data.TransactionID)
	if gatewayTxID == "" {
		gatewayTxID = strings.TrimSpace(resp.Data.SessionID)
	}
	if gatewayTxID == "" {
		gatewayTxID = strings.TrimSpace(resp.Data.ReferenceID)
	}

	instruction := ipaymuInstructionFromResponse(resp.Data, in, mc)
	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID: gatewayTxID,
		PaymentInstruction:   instruction.Normalize(),
		RawResponse:          rawResp,
		InitialStatus:        pgwtypes.PaymentStatusPending,
	}
	if ref := strings.TrimSpace(resp.Data.ReferenceID); ref != "" {
		result.ProviderTransactionID = &ref
	}
	if ref := strings.TrimSpace(resp.Data.PaymentNo); ref != "" {
		result.ExternalReference = &ref
	} else if ref := strings.TrimSpace(resp.Data.QRString); ref != "" {
		result.ExternalReference = &ref
	} else if ref := strings.TrimSpace(resp.Data.URL); ref != "" {
		result.ExternalReference = &ref
	}
	if exp := strings.TrimSpace(resp.Data.Expired); exp != "" {
		if t, err := parseTripayTime(exp); err == nil {
			result.ExpiredAt = &t
		}
	}

	return result, nil
}

func ipaymuInstructionFromResponse(data ipaymuDirectData, in pgwtypes.CreatePaymentInput, mc IPaymuMethodConfig) pgwtypes.PaymentInstruction {
	method := strings.ToLower(strings.TrimSpace(mc.PaymentMethod))
	instructionType, displayName := ipaymuInstructionMeta(method)
	instruction := pgwtypes.PaymentInstruction{
		Type:        instructionType,
		DisplayName: fallbackString(strings.TrimSpace(data.Channel), displayName),
		Amount:      in.Amount,
		Currency:    in.Currency,
	}
	if payNo := strings.TrimSpace(data.PaymentNo); payNo != "" {
		if instruction.Type == pgwtypes.InstructionTypeVA {
			instruction.VirtualAccountNumber = &payNo
		} else {
			if instruction.ExtraInfo == nil {
				instruction.ExtraInfo = map[string]any{}
			}
			instruction.ExtraInfo["payment_no"] = payNo
		}
	}
	if qr := strings.TrimSpace(data.QRString); qr != "" {
		instruction.Type = pgwtypes.InstructionTypeQris
		instruction.QRString = &qr
	}
	if u := strings.TrimSpace(data.URL); u != "" {
		if instruction.Type == "" {
			instruction.Type = pgwtypes.InstructionTypeRedirect
		}
		instruction.RedirectURL = &u
	}
	if exp := strings.TrimSpace(data.Expired); exp != "" {
		if t, err := parseTripayTime(exp); err == nil {
			instruction.ExpiredAt = &t
		}
	}
	return instruction
}

func ipaymuInstructionMeta(method string) (instructionType, displayName string) {
	switch method {
	case "va":
		return pgwtypes.InstructionTypeVA, "Virtual Account"
	case "cstore":
		return pgwtypes.InstructionTypeCStore, "Convenience Store"
	case "qris":
		return pgwtypes.InstructionTypeQris, "QRIS"
	case "cc", "paylater", "cod":
		return pgwtypes.InstructionTypeRedirect, "iPaymu"
	default:
		return pgwtypes.InstructionTypeRedirect, "iPaymu"
	}
}

func ipaymuCanonicalStatus(statusCode, status string) string {
	sc := strings.TrimSpace(statusCode)
	s := strings.ToLower(strings.TrimSpace(status))
	switch sc {
	case "1":
		return pgwtypes.PaymentStatusSucceeded
	case "0":
		return pgwtypes.PaymentStatusPending
	case "-2":
		return pgwtypes.PaymentStatusFailed
	}
	switch s {
	case "success", "paid", "settled":
		return pgwtypes.PaymentStatusSucceeded
	case "pending", "process", "unpaid":
		return pgwtypes.PaymentStatusPending
	case "failed", "expired", "cancelled", "canceled":
		return pgwtypes.PaymentStatusFailed
	default:
		return pgwtypes.PaymentStatusPending
	}
}

func ipaymuBaseURL(isProduction bool) string {
	if isProduction {
		return "https://my.ipaymu.com/"
	}
	return "https://sandbox.ipaymu.com/"
}

func ipaymuCustomerName(in pgwtypes.CreatePaymentInput) string {
	if v := strings.TrimSpace(in.CustomerName); v != "" {
		return v
	}
	if v := strings.TrimSpace(in.CustomerEmail); v != "" {
		return v
	}
	return "Customer"
}

func ipaymuCustomerEmail(in pgwtypes.CreatePaymentInput) string {
	if v := strings.TrimSpace(in.CustomerEmail); v != "" {
		return v
	}
	return "no-reply@example.com"
}

func ipaymuCustomerPhone(in pgwtypes.CreatePaymentInput) string {
	if v := strings.TrimSpace(in.CustomerPhone); v != "" {
		return v
	}
	return "081234567890"
}

func ipaymuProductName(metadata map[string]any) string {
	if metadata != nil {
		if v, ok := metadata["product_name"].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
		if v, ok := metadata["product_details"].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return "Payment"
}

func ipaymuHMACHex(message, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

func ipaymuParseCallbackBody(rawBody []byte) (map[string]any, error) {
	out := map[string]any{}
	if len(rawBody) == 0 {
		return out, fmt.Errorf("empty callback body")
	}
	if json.Unmarshal(rawBody, &out) == nil {
		return out, nil
	}
	vals, err := url.ParseQuery(string(rawBody))
	if err != nil {
		return nil, err
	}
	for k, arr := range vals {
		if len(arr) > 0 {
			out[k] = arr[0]
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("unsupported callback format")
	}
	return out, nil
}

func ipaymuAnyString(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch val := v.(type) {
			case string:
				return val
			case float64:
				return strconv.FormatInt(int64(val), 10)
			case int:
				return strconv.Itoa(val)
			case json.Number:
				return val.String()
			}
		}
	}
	return ""
}

func ipaymuCallbackSignature(payload map[string]any, secret string) (string, error) {
	copyMap := map[string]any{}
	for k, v := range payload {
		if strings.EqualFold(strings.TrimSpace(k), "signature") {
			continue
		}
		copyMap[k] = v
	}
	jsonBody, err := ipaymuMarshalSortedJSON(copyMap)
	if err != nil {
		return "", err
	}
	return ipaymuHMACHex(string(jsonBody), secret), nil
}

func ipaymuMarshalSortedJSON(m map[string]any) ([]byte, error) {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	buf := bytes.NewBufferString("{")
	for i, k := range keys {
		if i > 0 {
			buf.WriteByte(',')
		}
		keyJSON, err := json.Marshal(k)
		if err != nil {
			return nil, err
		}
		valJSON, err := json.Marshal(m[k])
		if err != nil {
			return nil, err
		}
		buf.Write(keyJSON)
		buf.WriteByte(':')
		buf.Write(valJSON)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

type ipaymuDirectData struct {
	TransactionID string `json:"TransactionId"`
	ReferenceID   string `json:"ReferenceId"`
	SessionID     string `json:"SessionId"`
	URL           string `json:"Url"`
	PaymentNo     string `json:"PaymentNo"`
	QRString      string `json:"QrString"`
	Via           string `json:"Via"`
	Channel       string `json:"Channel"`
	Expired       string `json:"Expired"`
}

type ipaymuDirectResponse struct {
	Status  int              `json:"Status"`
	Message string           `json:"Message"`
	Data    ipaymuDirectData `json:"Data"`
}
