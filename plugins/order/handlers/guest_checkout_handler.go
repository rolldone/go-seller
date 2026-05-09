package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	authservices "go_framework/plugins/auth/services"
	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"
	"go_framework/plugins/payment_gateway/pgwtypes"

	"github.com/gin-gonic/gin"
)

type GuestCheckoutHandler struct {
	orderSvc   *ordersvc.OrderService
	paymentSvc *ordersvc.PaymentService
	authSvc    *authservices.AuthService
}

func NewGuestCheckoutHandler(orderSvc *ordersvc.OrderService, paymentSvc *ordersvc.PaymentService, authSvc *authservices.AuthService) *GuestCheckoutHandler {
	return &GuestCheckoutHandler{orderSvc: orderSvc, paymentSvc: paymentSvc, authSvc: authSvc}
}

type generateGuestTokenReq struct {
	TTLSeconds int `json:"ttl_seconds"`
}

type guestCustomerAddressRequest struct {
	Label        string  `json:"label"`
	ReceiverName string  `json:"receiver_name" binding:"required"`
	PhoneNumber  string  `json:"phone_number" binding:"required"`
	AddressLine1 string  `json:"address_line_1" binding:"required"`
	AddressLine2 *string `json:"address_line_2"`
	Subdistrict  *string `json:"subdistrict"`
	District     *string `json:"district"`
	City         string  `json:"city" binding:"required"`
	Province     string  `json:"province" binding:"required"`
	PostalCode   string  `json:"postal_code" binding:"required"`
	Country      string  `json:"country"`
	Notes        *string `json:"notes"`
	IsPrimary    bool    `json:"is_primary"`
}

func (h *GuestCheckoutHandler) GenerateToken(c *gin.Context) {
	orderID := strings.TrimSpace(c.Param("id"))
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order id is required"})
		return
	}

	var req generateGuestTokenReq
	_ = c.ShouldBindJSON(&req)
	ttl := time.Hour
	if req.TTLSeconds > 0 {
		ttl = time.Duration(req.TTLSeconds) * time.Second
	}

	payload, err := h.orderSvc.GenerateGuestCheckoutToken(c.Request.Context(), orderID, ttl)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"token":        payload.Token,
		"order_id":     payload.OrderID,
		"customer_id":  payload.CustomerID,
		"issued_at":    payload.IssuedAt,
		"expires_at":   payload.ExpiresAt,
		"checkout_url": "/order?token=" + payload.Token,
	}})
}

func (h *GuestCheckoutHandler) GetDetail(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	payload, err := h.orderSvc.ResolveGuestCheckoutToken(c.Request.Context(), token)
	if err != nil {
		// special-case revoked token to allow frontend to show a friendly message
		if strings.Contains(strings.ToLower(err.Error()), "revoked") {
			c.JSON(http.StatusGone, gin.H{"error": err.Error(), "token_revoked": true})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "already used") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error(), "token_in_use": true})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	order, err := h.orderSvc.GetOrderByID(c.Request.Context(), payload.OrderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	payload.OrderSnapshot = *order

	_ = h.orderSvc.AppendGuestCheckoutAudit(c.Request.Context(), payload.OrderID, ordersvc.GuestCheckoutAuditEntry{
		EventType:  "redeem",
		Token:      payload.Token,
		CustomerID: payload.CustomerID,
		Metadata: map[string]any{
			"ip":         c.ClientIP(),
			"user_agent": c.Request.UserAgent(),
		},
	})

	var businessIDPtr *string
	if order.BusinessID != nil && strings.TrimSpace(*order.BusinessID) != "" {
		businessID := strings.TrimSpace(*order.BusinessID)
		businessIDPtr = &businessID
	}
	providers, err := h.paymentSvc.ListProviders(c.Request.Context(), ordersvc.PaymentProviderFilter{BusinessID: businessIDPtr, IncludeInactive: false})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	providerResp := make([]gin.H, 0, len(providers))
	for _, p := range providers {
		config := map[string]any{}
		if strings.EqualFold(strings.TrimSpace(p.ProviderKey), "bank_transfer") {
			config = parseProviderPublicConfig(p.Config)
		}
		providerResp = append(providerResp, gin.H{
			"id":           p.ID,
			"name":         p.Name,
			"provider_key": p.ProviderKey,
			"is_active":    p.IsActive,
			"config":       config,
		})
	}

	var customerResp any = nil
	if order.Customer != nil {
		customerResp = gin.H{
			"id":    order.Customer.ID,
			"name":  order.Customer.Name,
			"email": order.Customer.Email,
			"phone": order.Customer.Phone,
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"token":      payload.Token,
		"order":      orderToPublic(order),
		"customer":   customerResp,
		"providers":  providerResp,
		"expires_at": payload.ExpiresAt,
	}})
}

func (h *GuestCheckoutHandler) ListAddresses(c *gin.Context) {
	if h.authSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth service not configured"})
		return
	}
	token := strings.TrimSpace(c.Param("token"))
	payload, err := h.orderSvc.ResolveGuestCheckoutToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	items, err := h.authSvc.ListCustomerAddresses(c.Request.Context(), payload.CustomerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *GuestCheckoutHandler) CreateAddress(c *gin.Context) {
	if h.authSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth service not configured"})
		return
	}
	token := strings.TrimSpace(c.Param("token"))
	payload, err := h.orderSvc.ResolveGuestCheckoutToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req guestCustomerAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.authSvc.CreateCustomerAddress(c.Request.Context(), payload.CustomerID, authservices.CustomerAddressInput{
		Label:        req.Label,
		ReceiverName: req.ReceiverName,
		PhoneNumber:  req.PhoneNumber,
		AddressLine1: req.AddressLine1,
		AddressLine2: req.AddressLine2,
		Subdistrict:  req.Subdistrict,
		District:     req.District,
		City:         req.City,
		Province:     req.Province,
		PostalCode:   req.PostalCode,
		Country:      req.Country,
		Notes:        req.Notes,
		IsPrimary:    req.IsPrimary,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h *GuestCheckoutHandler) UpdateShippingAddress(c *gin.Context) {
	if h.authSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth service not configured"})
		return
	}
	token := strings.TrimSpace(c.Param("token"))
	payload, err := h.orderSvc.ResolveGuestCheckoutToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		AddressID string `json:"address_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	addr, err := h.authSvc.GetCustomerAddressByID(c.Request.Context(), payload.CustomerID, req.AddressID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address not found"})
		return
	}
	updated, err := h.orderSvc.UpdateShippingAddress(c.Request.Context(), payload.OrderID, *shippingAddressSnapshotFromCustomerAddress(addr))
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) || errors.Is(err, ordersvc.ErrShippingAddressLocked) || strings.Contains(strings.ToLower(err.Error()), "locked") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(updated)})
}

type guestStartPaymentReq struct {
	PaymentMethodID *string             `json:"payment_method_id"`
	ProviderID      *string             `json:"provider_id"`
	ProviderKey     *string             `json:"provider_key"`
	PaymentMethod   *string             `json:"payment_method"`
	GatewayName     *string             `json:"gateway_name"`
	Metadata        map[string]any      `json:"metadata"`
	SenderBank      *guestSenderBankReq `json:"sender_bank"`
	Transfer        *guestTransferReq   `json:"transfer"`
	ProofNotes      *string             `json:"proof_notes"`
}

type guestSenderBankReq struct {
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountHolder string `json:"account_holder"`
}

type guestTransferReq struct {
	Amount        float64 `json:"amount"`
	TransferredAt string  `json:"transferred_at"`
	Reference     string  `json:"reference"`
}

func strPtrIfNotEmpty(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

func parseProviderPublicConfig(raw []byte) map[string]any {
	out := map[string]any{}
	if len(raw) == 0 {
		return out
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return out
	}
	for _, key := range []string{"bank_name", "account_number", "account_holder", "account_name", "reference", "instructions"} {
		if value, ok := cfg[key]; ok {
			out[key] = value
		}
	}
	return out
}

func parseGuestStartPaymentReq(c *gin.Context) (guestStartPaymentReq, bool, error) {
	var req guestStartPaymentReq
	if strings.Contains(strings.ToLower(c.GetHeader("Content-Type")), "multipart/form-data") {
		req.PaymentMethodID = strPtrIfNotEmpty(c.PostForm("payment_method_id"))
		req.ProviderID = strPtrIfNotEmpty(c.PostForm("provider_id"))
		req.ProviderKey = strPtrIfNotEmpty(c.PostForm("provider_key"))
		req.PaymentMethod = strPtrIfNotEmpty(c.PostForm("payment_method"))
		req.GatewayName = strPtrIfNotEmpty(c.PostForm("gateway_name"))
		req.ProofNotes = strPtrIfNotEmpty(c.PostForm("proof_notes"))

		senderBankName := strings.TrimSpace(c.PostForm("sender_bank_name"))
		senderAccountNumber := strings.TrimSpace(c.PostForm("sender_account_number"))
		senderAccountHolder := strings.TrimSpace(c.PostForm("sender_account_holder"))
		if senderBankName != "" || senderAccountNumber != "" || senderAccountHolder != "" {
			req.SenderBank = &guestSenderBankReq{
				BankName:      senderBankName,
				AccountNumber: senderAccountNumber,
				AccountHolder: senderAccountHolder,
			}
		}

		transferAmountText := strings.TrimSpace(c.PostForm("transfer_amount"))
		transferredAt := strings.TrimSpace(c.PostForm("transferred_at"))
		reference := strings.TrimSpace(c.PostForm("reference"))
		if transferAmountText != "" || transferredAt != "" || reference != "" {
			transferAmount := 0.0
			if transferAmountText != "" {
				parsed, err := strconv.ParseFloat(transferAmountText, 64)
				if err != nil {
					return req, true, fmt.Errorf("invalid transfer_amount")
				}
				transferAmount = parsed
			}
			req.Transfer = &guestTransferReq{
				Amount:        transferAmount,
				TransferredAt: transferredAt,
				Reference:     reference,
			}
		}

		metadataJSON := strings.TrimSpace(c.PostForm("metadata_json"))
		if metadataJSON != "" {
			var metadata map[string]any
			if err := json.Unmarshal([]byte(metadataJSON), &metadata); err != nil {
				return req, true, fmt.Errorf("invalid metadata_json")
			}
			req.Metadata = metadata
		}

		return req, true, nil
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		return req, false, err
	}
	return req, false, nil
}

func (h *GuestCheckoutHandler) StartPayment(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	strVal := func(value *string) string {
		if value == nil {
			return ""
		}
		return strings.TrimSpace(*value)
	}
	log.Printf("[guest start-payment] begin token_len=%d content_type=%s", len(token), c.GetHeader("Content-Type"))
	payload, err := h.orderSvc.ResolveGuestCheckoutToken(c.Request.Context(), token)
	if err != nil {
		log.Printf("[guest start-payment] resolve token failed token_len=%d err=%v", len(token), err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	req, isMultipart, err := parseGuestStartPaymentReq(c)
	if err != nil {
		log.Printf("[guest start-payment] parse request failed order_id=%s token_len=%d err=%v", payload.OrderID, len(token), err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	log.Printf("[guest start-payment] parsed request order_id=%s multipart=%t provider_id=%s provider_key=%s payment_method_id=%s payment_method=%s gateway_name=%s", payload.OrderID, isMultipart, strVal(req.ProviderID), strVal(req.ProviderKey), strVal(req.PaymentMethodID), strVal(req.PaymentMethod), strVal(req.GatewayName))

	order, err := h.orderSvc.GetOrderByID(c.Request.Context(), payload.OrderID)
	if err != nil {
		log.Printf("[guest start-payment] order not found order_id=%s err=%v", payload.OrderID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	log.Printf("[guest start-payment] loaded order order_id=%s status=%s payment_status=%s channel=%s grand_total=%.2f business_id=%s", order.ID, order.Status, order.PaymentStatus, order.Channel, order.GrandTotal, strVal(order.BusinessID))
	if order.CustomerID == nil || strings.TrimSpace(*order.CustomerID) == "" || strings.TrimSpace(*order.CustomerID) != strings.TrimSpace(payload.CustomerID) {
		log.Printf("[guest start-payment] customer mismatch order_id=%s order_customer_id=%s payload_customer_id=%s", order.ID, strVal(order.CustomerID), payload.CustomerID)
		c.JSON(http.StatusForbidden, gin.H{"error": "customer mismatch"})
		return
	}
	if strings.EqualFold(order.Status, "awaiting_shipping") || strings.EqualFold(order.Status, "pending_shipping") || strings.EqualFold(order.Status, "awaiting_quote") ||
		strings.EqualFold(order.PaymentStatus, "awaiting_shipping") || strings.EqualFold(order.PaymentStatus, "pending_shipping") || strings.EqualFold(order.PaymentStatus, "awaiting_quote") {
		log.Printf("[guest start-payment] shipping quote pending order_id=%s status=%s payment_status=%s", order.ID, order.Status, order.PaymentStatus)
		c.JSON(http.StatusConflict, gin.H{"error": "shipping quote is pending; we will contact you via WhatsApp"})
		return
	}
	if !ordersvc.HasShippingAddress(order) {
		log.Printf("[guest start-payment] shipping address missing order_id=%s", order.ID)
		c.JSON(http.StatusConflict, gin.H{"error": "shipping address is required"})
		return
	}
	if strings.EqualFold(order.Channel, "web") && (strings.EqualFold(order.Status, "pending") || strings.EqualFold(order.PaymentStatus, "unpaid")) && !ordersvc.HasReadyShippingQuote(order) {
		log.Printf("[guest start-payment] shipping quote not ready order_id=%s status=%s payment_status=%s", order.ID, order.Status, order.PaymentStatus)
		c.JSON(http.StatusConflict, gin.H{"error": "shipping quote is pending; we will contact you via WhatsApp"})
		return
	}
	if strings.EqualFold(order.PaymentStatus, "paid") || order.PaidAt != nil {
		log.Printf("[guest start-payment] order already paid order_id=%s paid_at=%v payment_status=%s", order.ID, order.PaidAt, order.PaymentStatus)
		c.JSON(http.StatusConflict, gin.H{"error": "order already paid"})
		return
	}

	var selectedProvider *ordermodels.PaymentProvider
	var selectedMethodID *string
	if req.PaymentMethodID != nil && strings.TrimSpace(*req.PaymentMethodID) != "" {
		// Resolve provider from PaymentMethod mapping
		log.Printf("[guest start-payment] resolving via payment_method_id order_id=%s payment_method_id=%s", order.ID, strings.TrimSpace(*req.PaymentMethodID))
		provider, method, resolveErr := h.paymentSvc.ResolveProviderByMethodID(c.Request.Context(), strings.TrimSpace(*req.PaymentMethodID))
		if resolveErr != nil {
			log.Printf("[guest start-payment] resolve payment method failed order_id=%s payment_method_id=%s err=%v", order.ID, strings.TrimSpace(*req.PaymentMethodID), resolveErr)
			c.JSON(http.StatusBadRequest, gin.H{"error": resolveErr.Error()})
			return
		}
		selectedProvider = provider
		methodIDStr := method.ID
		selectedMethodID = &methodIDStr
		if req.PaymentMethod == nil || strings.TrimSpace(*req.PaymentMethod) == "" {
			req.PaymentMethod = &method.Name
		}
		log.Printf("[guest start-payment] resolved payment method order_id=%s provider_id=%s provider_key=%s method_id=%s method_name=%s", order.ID, provider.ID, provider.ProviderKey, method.ID, method.Name)
	} else if req.ProviderID != nil && strings.TrimSpace(*req.ProviderID) != "" {
		log.Printf("[guest start-payment] resolving via provider_id order_id=%s provider_id=%s", order.ID, strings.TrimSpace(*req.ProviderID))
		item, getErr := h.paymentSvc.GetProviderByID(c.Request.Context(), strings.TrimSpace(*req.ProviderID))
		if getErr != nil {
			log.Printf("[guest start-payment] provider lookup failed order_id=%s provider_id=%s err=%v", order.ID, strings.TrimSpace(*req.ProviderID), getErr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "payment provider not found"})
			return
		}
		selectedProvider = item
		log.Printf("[guest start-payment] resolved provider order_id=%s provider_id=%s provider_key=%s", order.ID, item.ID, item.ProviderKey)
	} else if req.ProviderKey != nil && strings.TrimSpace(*req.ProviderKey) != "" {
		log.Printf("[guest start-payment] resolving via provider_key order_id=%s provider_key=%s", order.ID, strings.TrimSpace(*req.ProviderKey))
		var businessIDPtr *string
		if order.BusinessID != nil && strings.TrimSpace(*order.BusinessID) != "" {
			bid := strings.TrimSpace(*order.BusinessID)
			businessIDPtr = &bid
		}
		items, listErr := h.paymentSvc.ListProviders(c.Request.Context(), ordersvc.PaymentProviderFilter{BusinessID: businessIDPtr, IncludeInactive: false})
		if listErr != nil {
			log.Printf("[guest start-payment] list providers failed order_id=%s provider_key=%s err=%v", order.ID, strings.TrimSpace(*req.ProviderKey), listErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": listErr.Error()})
			return
		}
		providerKey := strings.ToLower(strings.TrimSpace(*req.ProviderKey))
		for i := range items {
			if strings.ToLower(strings.TrimSpace(items[i].ProviderKey)) == providerKey {
				selectedProvider = &items[i]
				break
			}
		}
		if selectedProvider != nil {
			log.Printf("[guest start-payment] resolved provider by key order_id=%s provider_id=%s provider_key=%s", order.ID, selectedProvider.ID, selectedProvider.ProviderKey)
		}
	}

	if selectedProvider == nil {
		log.Printf("[guest start-payment] no provider resolved order_id=%s provider_id=%s provider_key=%s payment_method_id=%s", order.ID, strVal(req.ProviderID), strVal(req.ProviderKey), strVal(req.PaymentMethodID))
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider_id or provider_key is required"})
		return
	}
	if !selectedProvider.IsActive {
		log.Printf("[guest start-payment] provider inactive order_id=%s provider_id=%s provider_key=%s", order.ID, selectedProvider.ID, selectedProvider.ProviderKey)
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment provider is inactive"})
		return
	}

	if selectedProvider.BusinessID != nil && order.BusinessID != nil {
		if strings.TrimSpace(*selectedProvider.BusinessID) != strings.TrimSpace(*order.BusinessID) {
			log.Printf("[guest start-payment] provider business mismatch order_id=%s provider_business_id=%s order_business_id=%s", order.ID, strings.TrimSpace(*selectedProvider.BusinessID), strings.TrimSpace(*order.BusinessID))
			c.JSON(http.StatusBadRequest, gin.H{"error": "provider business mismatch"})
			return
		}
	}

	providerID := selectedProvider.ID
	providerKey := selectedProvider.ProviderKey
	providerKeyLower := strings.ToLower(strings.TrimSpace(providerKey))
	paymentMethod := providerKey
	gatewayName := providerKey
	if req.PaymentMethod != nil && strings.TrimSpace(*req.PaymentMethod) != "" {
		paymentMethod = strings.TrimSpace(*req.PaymentMethod)
	}
	if req.GatewayName != nil && strings.TrimSpace(*req.GatewayName) != "" {
		gatewayName = strings.TrimSpace(*req.GatewayName)
	}
	log.Printf("[guest start-payment] using provider order_id=%s provider_id=%s provider_key=%s payment_method=%s gateway_name=%s selected_method_id=%s", order.ID, providerID, providerKey, paymentMethod, gatewayName, strVal(selectedMethodID))

	metadata := map[string]any{
		"source":        "guest_checkout",
		"guest_token":   payload.Token,
		"guest_user_id": payload.CustomerID,
	}
	for k, v := range req.Metadata {
		metadata[k] = v
	}
	if providerKeyLower == "bank_transfer" {
		log.Printf("[guest start-payment] bank transfer branch order_id=%s payment_method=%s is_multipart=%t", order.ID, paymentMethod, isMultipart)
		if !isMultipart {
			log.Printf("[guest start-payment] bank transfer rejected because request is not multipart order_id=%s", order.ID)
			c.JSON(http.StatusBadRequest, gin.H{"error": "bank transfer requires multipart form-data with proof upload"})
			return
		}
		if req.SenderBank == nil {
			log.Printf("[guest start-payment] bank transfer rejected because sender bank missing order_id=%s", order.ID)
			c.JSON(http.StatusBadRequest, gin.H{"error": "sender bank information is required for bank transfer"})
			return
		}
		if strings.TrimSpace(req.SenderBank.BankName) == "" || strings.TrimSpace(req.SenderBank.AccountNumber) == "" || strings.TrimSpace(req.SenderBank.AccountHolder) == "" {
			log.Printf("[guest start-payment] bank transfer rejected because sender bank fields incomplete order_id=%s bank_name=%s account_number_present=%t account_holder_present=%t", order.ID, strings.TrimSpace(req.SenderBank.BankName), strings.TrimSpace(req.SenderBank.AccountNumber) != "", strings.TrimSpace(req.SenderBank.AccountHolder) != "")
			c.JSON(http.StatusBadRequest, gin.H{"error": "sender bank fields are required"})
			return
		}

		transferAmount := order.GrandTotal
		transferredAt := time.Now().UTC().Format(time.RFC3339)
		reference := ""
		if req.Transfer != nil {
			if req.Transfer.Amount > 0 {
				transferAmount = req.Transfer.Amount
			}
			if strings.TrimSpace(req.Transfer.TransferredAt) != "" {
				transferredAt = strings.TrimSpace(req.Transfer.TransferredAt)
			}
			reference = strings.TrimSpace(req.Transfer.Reference)
		}

		metadata["bank_transfer"] = map[string]any{
			"sender_bank": map[string]any{
				"bank_name":      strings.TrimSpace(req.SenderBank.BankName),
				"account_number": strings.TrimSpace(req.SenderBank.AccountNumber),
				"account_holder": strings.TrimSpace(req.SenderBank.AccountHolder),
			},
			"destination_bank": parseProviderPublicConfig(selectedProvider.Config),
			"transfer": map[string]any{
				"amount":         transferAmount,
				"transferred_at": transferredAt,
				"reference":      reference,
			},
		}
	}
	metadataJSON, _ := json.Marshal(metadata)

	cancelReason := "replaced by new guest checkout payment"
	log.Printf("[guest start-payment] cancelling previous pending payments order_id=%s", order.ID)
	if err := h.paymentSvc.CancelPendingPaymentsByOrder(c.Request.Context(), order.ID, "customer", &payload.CustomerID, &cancelReason); err != nil {
		log.Printf("[guest start-payment] cancel pending payments failed order_id=%s err=%v", order.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	log.Printf("[guest start-payment] creating payment record order_id=%s provider_key=%s payment_method=%s", order.ID, providerKeyLower, paymentMethod)

	payment := &ordermodels.Payment{
		OrderID:         order.ID,
		Amount:          order.GrandTotal,
		Currency:        order.Currency,
		ProviderID:      &providerID,
		ProviderKey:     &providerKey,
		PaymentMethodID: selectedMethodID,
		PaymentMethod:   &paymentMethod,
		GatewayName:     &gatewayName,
		Status:          string(ordersvc.StatusPending),
		ProofStatus:     "none",
		Metadata:        metadataJSON,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	locked, lockErr := ordersvc.AcquireGuestCheckoutTokenUse(c.Request.Context(), token, time.Hour)
	if lockErr != nil {
		log.Printf("[guest start-payment] acquire guest token lock failed order_id=%s err=%v", order.ID, lockErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": lockErr.Error()})
		return
	}
	if !locked {
		log.Printf("[guest start-payment] guest token already used order_id=%s", order.ID)
		c.JSON(http.StatusConflict, gin.H{"error": "token already used"})
		return
	}
	if err := h.paymentSvc.CreatePayment(c.Request.Context(), payment); err != nil {
		log.Printf("[guest start-payment] create payment record failed order_id=%s err=%v", order.ID, err)
		_ = ordersvc.ReleaseGuestCheckoutTokenUse(c.Request.Context(), token)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	log.Printf("[guest start-payment] payment record created order_id=%s payment_id=%s provider_key=%s", order.ID, payment.ID, providerKeyLower)

	if providerKeyLower == "bank_transfer" {
		log.Printf("[guest start-payment] bank transfer proof branch order_id=%s payment_id=%s", order.ID, payment.ID)
		// support multiple proof files uploaded as multipart form-data with key `proof`
		mform, mErr := c.MultipartForm()
		if mErr != nil {
			log.Printf("[guest start-payment] multipart parse failed order_id=%s payment_id=%s err=%v", order.ID, payment.ID, mErr)
			_ = ordersvc.ReleaseGuestCheckoutTokenUse(c.Request.Context(), token)
			_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
			c.JSON(http.StatusBadRequest, gin.H{"error": "proof file is required for bank transfer"})
			return
		}
		files := mform.File["proof"]
		if len(files) == 0 {
			log.Printf("[guest start-payment] proof file missing order_id=%s payment_id=%s", order.ID, payment.ID)
			_ = ordersvc.ReleaseGuestCheckoutTokenUse(c.Request.Context(), token)
			_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
			c.JSON(http.StatusBadRequest, gin.H{"error": "proof file is required for bank transfer"})
			return
		}
		for _, fh := range files {
			log.Printf("[guest start-payment] uploading proof order_id=%s payment_id=%s filename=%s size=%d", order.ID, payment.ID, fh.Filename, fh.Size)
			if _, uploadErr := h.paymentSvc.UploadPaymentProofAsGuest(c.Request.Context(), payment.ID, payload.CustomerID, fh, req.ProofNotes); uploadErr != nil {
				log.Printf("[guest start-payment] upload proof failed order_id=%s payment_id=%s filename=%s err=%v", order.ID, payment.ID, fh.Filename, uploadErr)
				_ = ordersvc.ReleaseGuestCheckoutTokenUse(c.Request.Context(), token)
				_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
				c.JSON(http.StatusBadRequest, gin.H{"error": uploadErr.Error()})
				return
			}
		}
		_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Where("id = ?", payment.ID).First(payment).Error
		log.Printf("[guest start-payment] bank transfer proof uploaded order_id=%s payment_id=%s", order.ID, payment.ID)
	} else if h.paymentSvc.AdapterRegistry != nil {
		log.Printf("[guest start-payment] attempting gateway adapter order_id=%s payment_id=%s provider_key=%s method_id=%s", order.ID, payment.ID, providerKeyLower, strVal(selectedMethodID))
		if adapter, ok := h.paymentSvc.AdapterRegistry.Get(providerKeyLower); ok {
			var methodConfig []byte
			if selectedMethodID != nil {
				if pm, pmErr := h.paymentSvc.GetPaymentMethodByID(c.Request.Context(), *selectedMethodID); pmErr == nil && pm != nil {
					methodConfig = pm.Config
				}
			}

			var customerName, customerEmail, customerPhone string
			if order.Customer != nil {
				customerName = order.Customer.Name
				customerEmail = order.Customer.Email
				customerPhone = order.Customer.Phone
			}

			adapterIn := pgwtypes.CreatePaymentInput{
				OrderID:              order.ID,
				PaymentID:            payment.ID,
				Amount:               order.GrandTotal,
				Currency:             order.Currency,
				MethodConfig:         methodConfig,
				ProviderConfig:       selectedProvider.Config,
				CredentialsEncrypted: selectedProvider.CredentialsEncrypted,
				CustomerName:         customerName,
				CustomerEmail:        customerEmail,
				CustomerPhone:        customerPhone,
			}
			log.Printf("[guest start-payment] calling adapter order_id=%s payment_id=%s provider_key=%s method_id=%s", order.ID, payment.ID, providerKeyLower, strVal(selectedMethodID))

			gatewayResult, gatewayErr := adapter.CreatePayment(c.Request.Context(), adapterIn)
			if gatewayErr != nil {
				log.Printf("[guest start-payment] gateway create failed order_id=%s payment_id=%s provider_key=%s method_id=%s err=%v", order.ID, payment.ID, providerKeyLower, strVal(selectedMethodID), gatewayErr)
				_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
				c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("failed to create gateway payment: %s", gatewayErr.Error())})
				return
			}

			log.Printf("[guest start-payment] gateway payment created order_id=%s payment_id=%s gateway_transaction_id=%s external_reference=%s instruction_type=%s", order.ID, payment.ID, gatewayResult.GatewayTransactionID, strVal(gatewayResult.ExternalReference), gatewayResult.PaymentInstruction.Type)

			updates := map[string]any{
				"gateway_transaction_id": gatewayResult.GatewayTransactionID,
				"updated_at":             time.Now(),
			}
			if gatewayResult.ProviderTransactionID != nil {
				updates["provider_transaction_id"] = *gatewayResult.ProviderTransactionID
			}
			if gatewayResult.ExternalReference != nil {
				updates["external_reference"] = *gatewayResult.ExternalReference
			}
			if gatewayResult.ExpiredAt != nil {
				updates["expired_at"] = *gatewayResult.ExpiredAt
			}
			if gatewayResult.RawResponse != nil {
				updates["response_payload"] = string(gatewayResult.RawResponse)
			}
			if instrJSON, err := json.Marshal(gatewayResult.PaymentInstruction); err == nil {
				updates["payment_instruction"] = string(instrJSON)
			}
			_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Model(&ordermodels.Payment{}).Where("id = ?", payment.ID).Updates(updates).Error
			_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Where("id = ?", payment.ID).First(payment).Error

			instrJSON, _ := json.Marshal(gatewayResult.PaymentInstruction)
			c.JSON(http.StatusCreated, gin.H{"data": payment, "payment_instruction": json.RawMessage(instrJSON)})
			return
		}

		log.Printf("[guest start-payment] payment gateway adapter not found order_id=%s payment_id=%s provider_key=%s", order.ID, payment.ID, providerKeyLower)
		_ = ordersvc.ReleaseGuestCheckoutTokenUse(c.Request.Context(), token)
		_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment gateway adapter not found for provider"})
		return
	} else if providerKeyLower != "bank_transfer" {
		log.Printf("[guest start-payment] payment gateway registry not configured order_id=%s payment_id=%s provider_key=%s", order.ID, payment.ID, providerKeyLower)
		_ = ordersvc.ReleaseGuestCheckoutTokenUse(c.Request.Context(), token)
		_ = h.paymentSvc.DB.WithContext(c.Request.Context()).Delete(&ordermodels.Payment{}, "id = ?", payment.ID).Error
		c.JSON(http.StatusInternalServerError, gin.H{"error": "payment gateway registry not configured"})
		return
	}

	_ = h.orderSvc.AppendGuestCheckoutAudit(c.Request.Context(), payload.OrderID, ordersvc.GuestCheckoutAuditEntry{
		EventType:  "start_payment",
		Token:      payload.Token,
		CustomerID: payload.CustomerID,
		PaymentID:  payment.ID,
		Metadata: map[string]any{
			"provider_id":  providerID,
			"provider_key": providerKey,
			"ip":           c.ClientIP(),
			"user_agent":   c.Request.UserAgent(),
		},
	})
	_ = ordersvc.RevokeGuestCheckoutToken(c.Request.Context(), token)

	c.JSON(http.StatusCreated, gin.H{"data": payment})
}
