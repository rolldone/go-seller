package services

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go_framework/internal/secrets"
	"go_framework/plugins/payment_gateway/pgwtypes"
)

type DuitkuProviderConfig struct {
	MerchantCode string `json:"merchant_code"`
	CallbackURL  string `json:"callback_url"`
	ReturnURL    string `json:"return_url"`
	IsProduction bool   `json:"is_production"`
}

type DuitkuCredentials struct {
	APIKey string `json:"api_key"`
}

type DuitkuMethodConfig struct {
	PaymentMethod string `json:"payment_method"`
}

type DuitkuAdapter struct {
	httpClient *http.Client
}

func NewDuitkuAdapter() *DuitkuAdapter {
	return &DuitkuAdapter{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

func (a *DuitkuAdapter) ProviderKey() string {
	return "duitku"
}

func (a *DuitkuAdapter) CreatePayment(ctx context.Context, in pgwtypes.CreatePaymentInput) (*pgwtypes.CreatePaymentResult, error) {
	cfg, creds, err := a.parseConfigs(in.ProviderConfig, in.CredentialsEncrypted)
	if err != nil {
		return nil, err
	}

	var mc DuitkuMethodConfig
	if len(in.MethodConfig) > 0 {
		if err := json.Unmarshal(in.MethodConfig, &mc); err != nil {
			return nil, fmt.Errorf("duitku: invalid method config: %w", err)
		}
	}

	if strings.TrimSpace(cfg.CallbackURL) == "" {
		return nil, fmt.Errorf("duitku: callback_url is required in provider config")
	}
	if strings.TrimSpace(cfg.ReturnURL) == "" {
		return nil, fmt.Errorf("duitku: return_url is required in provider config")
	}

	paymentAmount := int64(math.Round(in.Amount))
	paymentMethod := strings.ToUpper(strings.TrimSpace(mc.PaymentMethod))
	payload := map[string]any{
		"merchantCode":    cfg.MerchantCode,
		"paymentAmount":   paymentAmount,
		"merchantOrderId": in.PaymentID,
		"productDetails":  defaultDuitkuProductDetails(in.Metadata),
		"email":           strings.TrimSpace(in.CustomerEmail),
		"callbackUrl":     cfg.CallbackURL,
		"returnUrl":       cfg.ReturnURL,
		"signature":       duitkuTransactionSignature(cfg.MerchantCode, in.PaymentID, paymentAmount, creds.APIKey),
	}
	if paymentMethod != "" {
		payload["paymentMethod"] = paymentMethod
	}
	if phoneNumber := strings.TrimSpace(in.CustomerPhone); phoneNumber != "" {
		payload["phoneNumber"] = phoneNumber
	}
	if customerName := duitkuCustomerVAName(in); customerName != "" {
		payload["customerVaName"] = customerName
	}
	if in.ExpiredAt != nil {
		expiryPeriod := int(math.Ceil(time.Until(*in.ExpiredAt).Minutes()))
		if expiryPeriod > 0 {
			payload["expiryPeriod"] = expiryPeriod
		}
	}

	rawResp, err := a.callDuitku(ctx, http.MethodPost, duitkuInquiryURL(cfg.IsProduction), payload)
	if err != nil {
		return nil, err
	}

	return a.parseCreatePaymentResponse(rawResp, in, mc)
}

func (a *DuitkuAdapter) ParseWebhook(ctx context.Context, rawBody []byte, headers map[string]string, providerConfig json.RawMessage, credentialsEncrypted *string) (*pgwtypes.WebhookEvent, error) {
	_ = ctx
	_ = headers

	values, err := url.ParseQuery(string(rawBody))
	if err != nil {
		return nil, fmt.Errorf("duitku: failed to parse callback payload: %w", err)
	}

	merchantOrderID := strings.TrimSpace(values.Get("merchantOrderId"))
	reference := strings.TrimSpace(values.Get("reference"))
	amount := strings.TrimSpace(values.Get("amount"))
	resultCode := strings.TrimSpace(values.Get("resultCode"))
	signature := strings.TrimSpace(values.Get("signature"))
	paymentCode := strings.TrimSpace(values.Get("paymentCode"))
	publisherOrderID := strings.TrimSpace(values.Get("publisherOrderId"))

	if merchantOrderID == "" && reference == "" {
		return nil, fmt.Errorf("duitku: missing merchantOrderId and reference")
	}

	event := &pgwtypes.WebhookEvent{
		GatewayTransactionID: reference,
		RawPayload:           rawBody,
		SignatureValid:       false,
		EventType:            "callback",
		Status:               duitkuCallbackStatus(resultCode),
	}
	if merchantOrderID != "" {
		event.ProviderTransactionID = &merchantOrderID
	}
	if publisherOrderID != "" {
		event.ExternalReference = &publisherOrderID
	} else if paymentCode != "" {
		event.ExternalReference = &paymentCode
	}
	if reference != "" {
		key := reference + ":" + resultCode
		event.IdempotencyKey = &key
	}

	settlementDate := strings.TrimSpace(values.Get("settlementDate"))
	if event.Status == pgwtypes.PaymentStatusSucceeded && settlementDate != "" {
		if paidAt, err := time.Parse("2006-01-02", settlementDate); err == nil {
			event.PaidAt = &paidAt
		}
	}

	if len(providerConfig) == 0 || credentialsEncrypted == nil || strings.TrimSpace(*credentialsEncrypted) == "" {
		return event, nil
	}

	cfg, creds, err := a.parseConfigs(providerConfig, credentialsEncrypted)
	if err != nil {
		return nil, err
	}
	if cfg.MerchantCode == "" || amount == "" || merchantOrderID == "" || signature == "" {
		return event, nil
	}
	calc := duitkuCallbackSignature(cfg.MerchantCode, amount, merchantOrderID, creds.APIKey)
	if strings.EqualFold(signature, calc) {
		event.SignatureValid = true
	}

	return event, nil
}

func (a *DuitkuAdapter) parseConfigs(providerConfig json.RawMessage, credentialsEncrypted *string) (DuitkuProviderConfig, DuitkuCredentials, error) {
	var cfg DuitkuProviderConfig
	if len(providerConfig) > 0 {
		if err := json.Unmarshal(providerConfig, &cfg); err != nil {
			return cfg, DuitkuCredentials{}, fmt.Errorf("duitku: invalid provider config: %w", err)
		}
	}
	if strings.TrimSpace(cfg.MerchantCode) == "" {
		return cfg, DuitkuCredentials{}, fmt.Errorf("duitku: merchant_code is required in provider config")
	}

	var creds DuitkuCredentials
	if credentialsEncrypted != nil && strings.TrimSpace(*credentialsEncrypted) != "" {
		plain, err := secrets.DecryptBlob(*credentialsEncrypted)
		if err != nil {
			return cfg, creds, fmt.Errorf("duitku: invalid credentials: %w", err)
		}
		if err := json.Unmarshal(plain, &creds); err != nil {
			return cfg, creds, fmt.Errorf("duitku: invalid credentials: %w", err)
		}
	}
	if strings.TrimSpace(creds.APIKey) == "" {
		return cfg, creds, fmt.Errorf("duitku: api_key is required in credentials_encrypted")
	}
	return cfg, creds, nil
}

func (a *DuitkuAdapter) callDuitku(ctx context.Context, method, endpoint string, payload map[string]any) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("duitku: failed to encode request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("duitku: create request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("duitku: http error: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("duitku: read response error: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("duitku: http status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	return raw, nil
}

func (a *DuitkuAdapter) parseCreatePaymentResponse(rawResp []byte, in pgwtypes.CreatePaymentInput, mc DuitkuMethodConfig) (*pgwtypes.CreatePaymentResult, error) {
	var resp duitkuCreateInvoiceResponse
	if err := json.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("duitku: failed to parse create invoice response: %w", err)
	}
	if strings.TrimSpace(resp.StatusCode) != "00" {
		message := strings.TrimSpace(resp.StatusMessage)
		if message == "" {
			message = "create invoice failed"
		}
		return nil, fmt.Errorf("duitku: %s", message)
	}

	instruction := duitkuInstructionFromResponse(resp, in, mc)
	result := &pgwtypes.CreatePaymentResult{
		GatewayTransactionID: resp.Reference,
		PaymentInstruction:   instruction.Normalize(),
		RawResponse:          rawResp,
		InitialStatus:        pgwtypes.PaymentStatusPending,
	}
	if strings.TrimSpace(in.PaymentID) != "" {
		paymentID := strings.TrimSpace(in.PaymentID)
		result.ProviderTransactionID = &paymentID
	}
	if ref := strings.TrimSpace(resp.VANumber); ref != "" {
		result.ExternalReference = &ref
	} else if ref := strings.TrimSpace(resp.QRString); ref != "" {
		result.ExternalReference = &ref
	} else if ref := strings.TrimSpace(resp.PaymentURL); ref != "" {
		result.ExternalReference = &ref
	}
	return result, nil
}

func duitkuInquiryURL(isProduction bool) string {
	if isProduction {
		return "https://passport.duitku.com/webapi/api/merchant/v2/inquiry"
	}
	return "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry"
}

func duitkuTransactionSignature(merchantCode, merchantOrderID string, paymentAmount int64, apiKey string) string {
	return duitkuMD5(merchantCode + merchantOrderID + fmt.Sprintf("%d", paymentAmount) + apiKey)
}

func duitkuCallbackSignature(merchantCode, amount, merchantOrderID, apiKey string) string {
	return duitkuMD5(merchantCode + amount + merchantOrderID + apiKey)
}

func duitkuMD5(value string) string {
	sum := md5.Sum([]byte(value))
	return hex.EncodeToString(sum[:])
}

func duitkuCustomerVAName(in pgwtypes.CreatePaymentInput) string {
	if name := strings.TrimSpace(in.CustomerName); name != "" {
		return name
	}
	if email := strings.TrimSpace(in.CustomerEmail); email != "" {
		return email
	}
	return "Customer"
}

func defaultDuitkuProductDetails(metadata map[string]any) string {
	if metadata != nil {
		if val, ok := metadata["product_details"].(string); ok && strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val)
		}
		if val, ok := metadata["product_name"].(string); ok && strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val)
		}
	}
	return "Payment"
}

func duitkuCallbackStatus(resultCode string) string {
	switch strings.TrimSpace(resultCode) {
	case "00":
		return pgwtypes.PaymentStatusSucceeded
	case "01", "02":
		return pgwtypes.PaymentStatusFailed
	default:
		return pgwtypes.PaymentStatusPending
	}
}

func duitkuInstructionFromResponse(resp duitkuCreateInvoiceResponse, in pgwtypes.CreatePaymentInput, mc DuitkuMethodConfig) pgwtypes.PaymentInstruction {
	paymentMethod := strings.ToUpper(strings.TrimSpace(mc.PaymentMethod))
	typeKey, displayName, bankCode := duitkuInstructionMeta(paymentMethod)
	instruction := pgwtypes.PaymentInstruction{
		Type:        typeKey,
		DisplayName: displayName,
		Amount:      in.Amount,
		Currency:    in.Currency,
	}
	if bankCode != "" {
		instruction.BankCode = &bankCode
	}
	if va := strings.TrimSpace(resp.VANumber); va != "" {
		instruction.VirtualAccountNumber = &va
		if instruction.Type == "" {
			instruction.Type = pgwtypes.InstructionTypeVA
		}
	}
	if qr := strings.TrimSpace(resp.QRString); qr != "" {
		instruction.QRString = &qr
		instruction.Type = pgwtypes.InstructionTypeQris
	}
	if redirect := strings.TrimSpace(resp.PaymentURL); redirect != "" {
		if instruction.Type == "" {
			instruction.Type = pgwtypes.InstructionTypeRedirect
		}
		instruction.RedirectURL = &redirect
	}
	if instruction.DisplayName == "" {
		instruction.DisplayName = displayName
	}
	if instruction.ExtraInfo == nil {
		instruction.ExtraInfo = map[string]any{}
	}
	if appURL := strings.TrimSpace(resp.AppURL); appURL != "" {
		instruction.ExtraInfo["app_url"] = appURL
		if instruction.Type == pgwtypes.InstructionTypeEWallet && instruction.RedirectURL == nil {
			instruction.RedirectURL = &appURL
		}
	}
	if instruction.ExtraInfo != nil && len(instruction.ExtraInfo) == 0 {
		instruction.ExtraInfo = nil
	}
	return instruction
}

func duitkuInstructionMeta(paymentMethod string) (instructionType, displayName, bankCode string) {
	switch paymentMethod {
	case "BC":
		return pgwtypes.InstructionTypeVA, "BCA Virtual Account", "bca"
	case "M2":
		return pgwtypes.InstructionTypeVA, "Mandiri Virtual Account", "mandiri"
	case "VA":
		return pgwtypes.InstructionTypeVA, "Maybank Virtual Account", "maybank"
	case "I1":
		return pgwtypes.InstructionTypeVA, "BNI Virtual Account", "bni"
	case "B1":
		return pgwtypes.InstructionTypeVA, "CIMB Niaga Virtual Account", "cimb"
	case "BT":
		return pgwtypes.InstructionTypeVA, "Permata Virtual Account", "permata"
	case "A1":
		return pgwtypes.InstructionTypeVA, "ATM Bersama", "atm_bersama"
	case "AG":
		return pgwtypes.InstructionTypeVA, "Artha Graha Virtual Account", "artha_graha"
	case "NC":
		return pgwtypes.InstructionTypeVA, "Neo Commerce Virtual Account", "neo_commerce"
	case "BR":
		return pgwtypes.InstructionTypeVA, "BRIVA", "bri"
	case "S1":
		return pgwtypes.InstructionTypeVA, "Sahabat Sampoerna Virtual Account", "sampoerna"
	case "DM":
		return pgwtypes.InstructionTypeVA, "Danamon Virtual Account", "danamon"
	case "BV":
		return pgwtypes.InstructionTypeVA, "BSI Virtual Account", "bsi"
	case "FT":
		return pgwtypes.InstructionTypeCStore, "Retail Payment", ""
	case "IR":
		return pgwtypes.InstructionTypeCStore, "Indomaret", ""
	case "OV":
		return pgwtypes.InstructionTypeEWallet, "OVO", ""
	case "SA":
		return pgwtypes.InstructionTypeEWallet, "ShopeePay Apps", ""
	case "LF", "LA":
		return pgwtypes.InstructionTypeEWallet, "LinkAja", ""
	case "DA":
		return pgwtypes.InstructionTypeEWallet, "DANA", ""
	case "SL":
		return pgwtypes.InstructionTypeEWallet, "ShopeePay Account Link", ""
	case "OL":
		return pgwtypes.InstructionTypeEWallet, "OVO Account Link", ""
	case "SP", "NQ", "GQ", "SQ":
		return pgwtypes.InstructionTypeQris, "QRIS", ""
	default:
		return pgwtypes.InstructionTypeRedirect, "Duitku", ""
	}
}

type duitkuCreateInvoiceResponse struct {
	MerchantCode  string `json:"merchantCode"`
	Reference     string `json:"reference"`
	PaymentURL    string `json:"paymentUrl"`
	VANumber      string `json:"vaNumber"`
	QRString      string `json:"qrString"`
	AppURL        string `json:"appUrl"`
	Amount        string `json:"amount"`
	StatusCode    string `json:"statusCode"`
	StatusMessage string `json:"statusMessage"`
}
