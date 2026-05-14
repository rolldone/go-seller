package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	authservices "go_framework/plugins/auth/services"
	catalogservices "go_framework/plugins/catalog/services"
	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MemberOrderHandler struct {
	*OrderHandler
}

type memberCreateDraftOrderReq struct {
	UserID          *string `json:"user_id"`
	CustomerID      *string `json:"customer_id"`
	FulfillmentType string  `json:"fulfillment_type"`
	Currency        string  `json:"currency"`
}

type memberManualValidatePaymentReq struct {
	Note *string `json:"note"`
}

func NewMemberOrderHandler(svc *ordersvc.OrderService, paymentSvc *ordersvc.PaymentService, catalogSvc *catalogservices.CatalogService, authSvc *authservices.AuthService) *MemberOrderHandler {
	return &MemberOrderHandler{OrderHandler: NewOrderHandler(svc, paymentSvc, catalogSvc, authSvc)}
}

func (h *MemberOrderHandler) List(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	if _, ok := memberBusinessAccess(c, h.catalogSvc, businessID); !ok {
		return
	}
	orders, total, err := h.svc.ListOrders(c.Request.Context(), ordersvc.OrderListFilter{
		Query:         c.Query("q"),
		BusinessID:    businessID,
		Status:        c.Query("status"),
		PaymentStatus: c.Query("payment_status"),
		Channel:       c.Query("channel"),
		Page: func() int {
			p, _ := strconv.Atoi(strings.TrimSpace(c.Query("page")))
			if p > 0 {
				return p
			}
			return 1
		}(),
		Limit: func() int {
			l, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))
			if l > 0 {
				return l
			}
			return 20
		}(),
		Sort: c.Query("sort"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders, "total": total})
}

func (h *MemberOrderHandler) ListCustomers(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	if _, ok := memberBusinessAccess(c, h.catalogSvc, businessID); !ok {
		return
	}

	items, total, err := h.svc.ListBusinessCustomerHistory(c.Request.Context(), businessID, c.Query("q"), func() int {
		p, _ := strconv.Atoi(strings.TrimSpace(c.Query("page")))
		if p > 0 {
			return p
		}
		return 1
	}(), func() int {
		l, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))
		if l > 0 {
			return l
		}
		return 20
	}())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *MemberOrderHandler) GetByID(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	ord, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID)
	if !ok {
		return
	}
	business, err := h.loadBusinessSummary(c.Request.Context(), ord.BusinessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"order": orderToPublic(ord), "payments": ord.Payments, "business": business}})
}

func (h *MemberOrderHandler) DownloadInvoice(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}
	pdfBytes, filename, err := h.svc.GenerateInvoicePDF(c.Request.Context(), orderID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "record not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		if errors.Is(err, ordersvc.ErrInvoiceRenderFailed) {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (h *MemberOrderHandler) ManualValidatePaymentFromHistory(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	paymentID := strings.TrimSpace(c.Param("payment_id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}
	var req memberManualValidatePaymentReq
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}
	memberIDPtr := &memberID
	updated, err := h.paymentSvc.ValidateOrderPaymentFromHistory(c.Request.Context(), orderID, paymentID, "member", memberIDPtr, ordersvc.ManualOrderPaymentValidationInput{Note: req.Note})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not successful") || strings.Contains(strings.ToLower(err.Error()), "payment not found") || strings.Contains(strings.ToLower(err.Error()), "order expired") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": updated})
}

func (h *MemberOrderHandler) ListPaymentProofs(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	paymentID := strings.TrimSpace(c.Param("payment_id"))
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment_id is required"})
		return
	}

	ord, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID)
	if !ok {
		return
	}
	if h.paymentSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "payment service not configured"})
		return
	}

	paymentOwned := false
	for _, payment := range ord.Payments {
		if strings.TrimSpace(payment.ID) == paymentID {
			paymentOwned = true
			break
		}
	}
	if !paymentOwned {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	proofs, err := h.paymentSvc.ListPaymentProofs(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": proofs})
}

func (h *MemberOrderHandler) PaymentProofAccess(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	paymentID := strings.TrimSpace(c.Param("payment_id"))
	proofID := strings.TrimSpace(c.Param("proof_id"))
	if paymentID == "" || proofID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment_id and proof_id are required"})
		return
	}

	ord, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID)
	if !ok {
		return
	}
	if h.paymentSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "payment service not configured"})
		return
	}

	paymentOwned := false
	for _, payment := range ord.Payments {
		if strings.TrimSpace(payment.ID) == paymentID {
			paymentOwned = true
			break
		}
	}
	if !paymentOwned {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	var proof ordermodels.PaymentProof
	if err := h.paymentSvc.DB.WithContext(c.Request.Context()).Where("id = ? AND payment_id = ? AND deleted_at IS NULL", proofID, paymentID).First(&proof).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "proof not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if h.paymentSvc.Store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage not configured"})
		return
	}
	if strings.TrimSpace(proof.StorageKey) == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no storage key for proof"})
		return
	}

	rc, err := h.paymentSvc.Store.Get(c.Request.Context(), proof.StorageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "failed to retrieve proof from storage"})
		return
	}
	defer rc.Close()

	if proof.MimeType != "" {
		c.Header("Content-Type", proof.MimeType)
	} else {
		c.Header("Content-Type", "application/octet-stream")
	}
	if proof.FileSize > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", proof.FileSize))
	}
	filename := proof.StorageKey
	if idx := strings.LastIndex(proof.StorageKey, "/"); idx >= 0 && idx+1 < len(proof.StorageKey) {
		filename = proof.StorageKey[idx+1:]
	}
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", filename))

	if _, err := io.Copy(c.Writer, rc); err != nil {
		c.Error(err)
		return
	}
}

func (h *MemberOrderHandler) CreateDraft(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	if _, ok := memberBusinessAccess(c, h.catalogSvc, businessID); !ok {
		return
	}

	var req memberCreateDraftOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Currency) == "" {
		req.Currency = "IDR"
	}
	if strings.TrimSpace(req.FulfillmentType) == "" {
		req.FulfillmentType = "delivery"
	}

	ord, err := h.svc.CreateDraftOrderAsAdmin(c.Request.Context(), "", req.UserID, req.CustomerID, &businessID, req.FulfillmentType, req.Currency)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": orderToPublic(ord)})
}

func (h *MemberOrderHandler) Update(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	var req updateOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.UpdateOrderCustomerAndFulfillment(c.Request.Context(), orderID, req.CustomerID, req.FulfillmentType)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(ord)})
}

func (h *MemberOrderHandler) AddItem(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	var req addOrderItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Qty <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "qty must be greater than zero"})
		return
	}
	if req.UnitPrice < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unit_price must be non-negative"})
		return
	}

	item := ordermodels.OrderItem{
		ProductID:      req.ProductID,
		ProductName:    req.ProductName,
		SKU:            req.SKU,
		Qty:            req.Qty,
		UnitPrice:      req.UnitPrice,
		DiscountAmount: req.DiscountAmount,
	}
	created, err := h.svc.AddItemToOrder(c.Request.Context(), orderID, item)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": created})
}

func (h *MemberOrderHandler) DeleteItem(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	itemID := strings.TrimSpace(c.Param("item_id"))
	if err := h.svc.RemoveOrderItem(c.Request.Context(), orderID, itemID); err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *MemberOrderHandler) ApplyItemDiscount(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	itemID := strings.TrimSpace(c.Param("item_id"))
	var req applyOrderItemDiscountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.ApplyDiscountToOrderItem(c.Request.Context(), orderID, itemID, req.DiscountID)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(ord)})
}

func (h *MemberOrderHandler) RemoveItemDiscount(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	itemID := strings.TrimSpace(c.Param("item_id"))
	ord, err := h.svc.RemoveDiscountFromOrderItem(c.Request.Context(), orderID, itemID)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(ord)})
}

func (h *MemberOrderHandler) Finalize(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	ord, err := h.svc.FinalizeOrder(c.Request.Context(), orderID)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(ord)})
}

func (h *MemberOrderHandler) RequestCustomerConfirmation(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	var req requestCustomerConfirmationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated, err := h.svc.RequestCustomerConfirmation(c.Request.Context(), orderID, &req.Message)
	if err != nil {
		if errors.Is(err, ordersvc.ErrCustomerConfirmationDisabled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, ordersvc.ErrCustomerConfirmationUnavailable) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(updated)})
}

func (h *MemberOrderHandler) UpsertDisputeNote(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	memberID, ok := memberIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing member context"})
		return
	}

	var req disputeNoteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.svc.UpsertSellerDisputeNote(c.Request.Context(), orderID, memberID, req.Note)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderDisputeNotOpen) || errors.Is(err, ordersvc.ErrOrderDisputeAlreadyResolved) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(updated)})
}

func (h *MemberOrderHandler) ApplyCoupon(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	var req applyCouponReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.ApplyCouponToOrder(c.Request.Context(), orderID, req.CouponCode)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, ordersvc.ErrDuplicateCouponCategory) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(ord)})
}

func (h *MemberOrderHandler) RemoveCoupon(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	couponCode := strings.TrimSpace(c.Param("code"))
	ord, err := h.svc.RemoveCouponFromOrder(c.Request.Context(), orderID, couponCode)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(ord)})
}

func (h *MemberOrderHandler) UpdateShippingAddress(c *gin.Context) {
	if h.authSvc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth service not configured"})
		return
	}
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	ord, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID)
	if !ok {
		return
	}
	if ord.CustomerID == nil || strings.TrimSpace(*ord.CustomerID) == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "order customer is required"})
		return
	}

	var req updateShippingAddressReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	addr, err := h.authSvc.GetCustomerAddressByID(c.Request.Context(), strings.TrimSpace(*ord.CustomerID), req.AddressID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "address not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.svc.UpdateShippingAddress(c.Request.Context(), ord.ID, *shippingAddressSnapshotFromCustomerAddress(addr))
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) || errors.Is(err, ordersvc.ErrShippingAddressLocked) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(updated)})
}

type memberReplaceOrderExtraChargesReq struct {
	Charges []struct {
		Name      string  `json:"name"`
		Amount    float64 `json:"amount"`
		Notes     string  `json:"notes"`
		SortOrder int     `json:"sort_order"`
	} `json:"charges"`
}

func (h *MemberOrderHandler) ReplaceExtraCharges(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	var req memberReplaceOrderExtraChargesReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	inputs := make([]ordersvc.ExtraChargeInput, 0, len(req.Charges))
	for _, item := range req.Charges {
		inputs = append(inputs, ordersvc.ExtraChargeInput{
			Name:      item.Name,
			Amount:    item.Amount,
			Notes:     item.Notes,
			SortOrder: item.SortOrder,
		})
	}

	updated, err := h.svc.ReplaceOrderExtraCharges(c.Request.Context(), orderID, "", inputs)
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(updated)})
}

func (h *MemberOrderHandler) UpdateShippingQuote(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	orderID := strings.TrimSpace(c.Param("id"))
	if _, ok := memberOrderAccess(c, h.svc, h.catalogSvc, businessID, orderID); !ok {
		return
	}

	var req updateShippingQuoteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ord, err := h.svc.UpdateShippingQuote(c.Request.Context(), orderID, ordersvc.ShippingQuoteDetails{
		ShippingAmount:    req.ShippingAmount,
		CarrierName:       req.CarrierName,
		ServiceName:       req.ServiceName,
		EstimatedDelivery: req.EstimatedDelivery,
		Description:       req.Description,
		Notes:             req.Notes,
	})
	if err != nil {
		if errors.Is(err, ordersvc.ErrOrderAlreadyPaid) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orderToPublic(ord)})
}
