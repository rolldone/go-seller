package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"
	settingmodels "go_framework/plugins/setting/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	customerConfirmationMetadataKey = "customer_confirmation"
	orderDisputeMetadataKey         = "dispute"
	orderDisputeDecisionOpen        = "open"
	orderDisputeDecisionSellerWon   = "seller_won"
	orderDisputeDecisionCustomerWon = "customer_won_pending_refund"
	orderDisputeDecisionRefunded    = "refunded"
)

var ErrCustomerConfirmationUnavailable = errors.New("customer confirmation is not available for this order")
var ErrCustomerConfirmationDisabled = errors.New("customer confirmation feature is disabled")
var ErrCustomerConfirmationNotPending = errors.New("order is not waiting for customer confirmation")
var ErrCustomerConfirmationReasonRequired = errors.New("rejection reason is required")
var ErrOrderDisputeNotOpen = errors.New("order dispute is not open")
var ErrOrderDisputeNoteRequired = errors.New("dispute note is required")
var ErrOrderDisputeAdminNoteRequired = errors.New("admin note is required")
var ErrOrderDisputeAlreadyResolved = errors.New("order dispute has already been resolved")
var ErrOrderDisputeRefundNoteRequired = errors.New("refund note is required")
var ErrOrderDisputeRefundNotPending = errors.New("order dispute is not waiting for refund completion")

type customerConfirmationMetadata struct {
	Status        string
	SellerMessage *string
	RequestedAt   *time.Time
	ApprovedAt    *time.Time
	RejectedAt    *time.Time
	RejectReason  *string
}

type orderDisputeMetadata struct {
	OpenedAt                 *time.Time
	CustomerReason           *string
	SellerNote               *string
	SellerNoteAt             *time.Time
	SellerMemberID           *string
	AdminDecision            string
	AdminNote                *string
	ResolvedByAdminID        *string
	ResolvedAt               *time.Time
	RefundNote               *string
	RefundCompletedByAdminID *string
	RefundCompletedAt        *time.Time
}

func parseOrderMetadataRoot(raw []byte) map[string]any {
	if len(raw) == 0 || strings.EqualFold(strings.TrimSpace(string(raw)), "null") {
		return map[string]any{}
	}
	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil || root == nil {
		return map[string]any{}
	}
	return root
}

func parseOptionalTime(raw any) *time.Time {
	text, ok := raw.(string)
	if !ok {
		return nil
	}
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return &parsed
		}
	}
	return nil
}

func normalizeOptionalText(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func readCustomerConfirmationMetadata(root map[string]any) customerConfirmationMetadata {
	raw, ok := root[customerConfirmationMetadataKey]
	if !ok {
		return customerConfirmationMetadata{}
	}
	entry, ok := raw.(map[string]any)
	if !ok {
		return customerConfirmationMetadata{}
	}
	state := customerConfirmationMetadata{}
	if status, ok := entry["status"].(string); ok {
		state.Status = strings.TrimSpace(status)
	}
	if message, ok := entry["seller_message"].(string); ok {
		state.SellerMessage = normalizeOptionalText(message)
	}
	state.RequestedAt = parseOptionalTime(entry["requested_at"])
	state.ApprovedAt = parseOptionalTime(entry["approved_at"])
	state.RejectedAt = parseOptionalTime(entry["rejected_at"])
	if reason, ok := entry["reject_reason"].(string); ok {
		state.RejectReason = normalizeOptionalText(reason)
	}
	return state
}

func (m customerConfirmationMetadata) toMap() map[string]any {
	out := map[string]any{}
	if trimmed := strings.TrimSpace(m.Status); trimmed != "" {
		out["status"] = trimmed
	}
	if m.SellerMessage != nil && strings.TrimSpace(*m.SellerMessage) != "" {
		out["seller_message"] = strings.TrimSpace(*m.SellerMessage)
	}
	if m.RequestedAt != nil {
		out["requested_at"] = m.RequestedAt.UTC().Format(time.RFC3339)
	}
	if m.ApprovedAt != nil {
		out["approved_at"] = m.ApprovedAt.UTC().Format(time.RFC3339)
	}
	if m.RejectedAt != nil {
		out["rejected_at"] = m.RejectedAt.UTC().Format(time.RFC3339)
	}
	if m.RejectReason != nil && strings.TrimSpace(*m.RejectReason) != "" {
		out["reject_reason"] = strings.TrimSpace(*m.RejectReason)
	}
	return out
}

func readOrderDisputeMetadata(root map[string]any) orderDisputeMetadata {
	raw, ok := root[orderDisputeMetadataKey]
	if !ok {
		return orderDisputeMetadata{}
	}
	entry, ok := raw.(map[string]any)
	if !ok {
		return orderDisputeMetadata{}
	}
	state := orderDisputeMetadata{}
	state.OpenedAt = parseOptionalTime(entry["opened_at"])
	if reason, ok := entry["customer_reason"].(string); ok {
		state.CustomerReason = normalizeOptionalText(reason)
	}
	if note, ok := entry["seller_note"].(string); ok {
		state.SellerNote = normalizeOptionalText(note)
	}
	state.SellerNoteAt = parseOptionalTime(entry["seller_note_at"])
	if memberID, ok := entry["seller_member_id"].(string); ok {
		state.SellerMemberID = normalizeOptionalText(memberID)
	}
	if decision, ok := entry["admin_decision"].(string); ok {
		state.AdminDecision = strings.TrimSpace(decision)
	}
	if adminNote, ok := entry["admin_note"].(string); ok {
		state.AdminNote = normalizeOptionalText(adminNote)
	}
	if adminID, ok := entry["resolved_by_admin_id"].(string); ok {
		state.ResolvedByAdminID = normalizeOptionalText(adminID)
	}
	state.ResolvedAt = parseOptionalTime(entry["resolved_at"])
	if refundNote, ok := entry["refund_note"].(string); ok {
		state.RefundNote = normalizeOptionalText(refundNote)
	}
	if adminID, ok := entry["refund_completed_by_admin_id"].(string); ok {
		state.RefundCompletedByAdminID = normalizeOptionalText(adminID)
	}
	state.RefundCompletedAt = parseOptionalTime(entry["refund_completed_at"])
	return state
}

func (m orderDisputeMetadata) toMap() map[string]any {
	out := map[string]any{}
	if m.OpenedAt != nil {
		out["opened_at"] = m.OpenedAt.UTC().Format(time.RFC3339)
	}
	if m.CustomerReason != nil && strings.TrimSpace(*m.CustomerReason) != "" {
		out["customer_reason"] = strings.TrimSpace(*m.CustomerReason)
	}
	if m.SellerNote != nil && strings.TrimSpace(*m.SellerNote) != "" {
		out["seller_note"] = strings.TrimSpace(*m.SellerNote)
	}
	if m.SellerNoteAt != nil {
		out["seller_note_at"] = m.SellerNoteAt.UTC().Format(time.RFC3339)
	}
	if m.SellerMemberID != nil && strings.TrimSpace(*m.SellerMemberID) != "" {
		out["seller_member_id"] = strings.TrimSpace(*m.SellerMemberID)
	}
	if trimmed := strings.TrimSpace(m.AdminDecision); trimmed != "" {
		out["admin_decision"] = trimmed
	}
	if m.AdminNote != nil && strings.TrimSpace(*m.AdminNote) != "" {
		out["admin_note"] = strings.TrimSpace(*m.AdminNote)
	}
	if m.ResolvedByAdminID != nil && strings.TrimSpace(*m.ResolvedByAdminID) != "" {
		out["resolved_by_admin_id"] = strings.TrimSpace(*m.ResolvedByAdminID)
	}
	if m.ResolvedAt != nil {
		out["resolved_at"] = m.ResolvedAt.UTC().Format(time.RFC3339)
	}
	if m.RefundNote != nil && strings.TrimSpace(*m.RefundNote) != "" {
		out["refund_note"] = strings.TrimSpace(*m.RefundNote)
	}
	if m.RefundCompletedByAdminID != nil && strings.TrimSpace(*m.RefundCompletedByAdminID) != "" {
		out["refund_completed_by_admin_id"] = strings.TrimSpace(*m.RefundCompletedByAdminID)
	}
	if m.RefundCompletedAt != nil {
		out["refund_completed_at"] = m.RefundCompletedAt.UTC().Format(time.RFC3339)
	}
	return out
}

func normalizeDisputeDecision(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

type orderNotificationRecipient struct {
	Email string
	Name  string
}

func normalizeNotificationLocale(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if strings.HasPrefix(trimmed, "en") {
		return "en"
	}
	return "id"
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func (s *OrderService) lookupBusinessNotificationOwner(ctx context.Context, businessID string) (orderNotificationRecipient, error) {
	var info struct {
		Email    string
		FullName string
	}
	err := s.DB.WithContext(ctx).
		Table("business_members bm").
		Joins("JOIN users u ON u.id = bm.user_id AND u.deleted_at IS NULL").
		Where("bm.business_id = ? AND bm.is_owner = true AND bm.deleted_at IS NULL", businessID).
		Select("u.email, u.full_name").
		Limit(1).
		Scan(&info).Error
	if err != nil {
		return orderNotificationRecipient{}, err
	}
	return orderNotificationRecipient{
		Email: strings.TrimSpace(info.Email),
		Name:  strings.TrimSpace(info.FullName),
	}, nil
}

func (s *OrderService) loadBusinessNotificationRecipients(ctx context.Context, businessID string, eventKey string) ([]orderNotificationRecipient, error) {
	var groups []models.MemberNotificationGroup
	if err := s.DB.WithContext(ctx).
		Where("business_id = ? AND is_active = true", businessID).
		Find(&groups).Error; err != nil {
		return nil, err
	}

	groupIDs := make([]int64, 0, len(groups))
	for _, group := range groups {
		if !group.MatchesEvent(eventKey) {
			continue
		}
		groupIDs = append(groupIDs, group.ID)
	}
	if len(groupIDs) == 0 {
		return nil, nil
	}

	type recipientRow struct {
		Email    string
		FullName string
	}
	var rows []recipientRow
	if err := s.DB.WithContext(ctx).
		Table("member_notification_group_members mngm").
		Joins("JOIN users u ON u.id = mngm.user_id AND u.deleted_at IS NULL").
		Joins("JOIN business_members bm ON bm.user_id = u.id AND bm.business_id = ? AND bm.deleted_at IS NULL", businessID).
		Where("mngm.group_id IN ?", groupIDs).
		Select("DISTINCT LOWER(u.email) AS email, COALESCE(NULLIF(u.full_name, ''), u.email) AS full_name").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	recipients := make([]orderNotificationRecipient, 0, len(rows))
	seen := map[string]struct{}{}
	for _, row := range rows {
		email := strings.TrimSpace(row.Email)
		if email == "" {
			continue
		}
		key := strings.ToLower(email)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		recipients = append(recipients, orderNotificationRecipient{
			Email: email,
			Name:  strings.TrimSpace(row.FullName),
		})
	}
	return recipients, nil
}

func (s *OrderService) lookupBusinessName(ctx context.Context, businessID string) string {
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		return "Go Seller"
	}
	var info struct {
		Name string
	}
	if err := s.DB.WithContext(ctx).
		Table("businesses").
		Where("id = ?", trimmedBusinessID).
		Select("name").
		Limit(1).
		Scan(&info).Error; err != nil {
		return "Go Seller"
	}
	if trimmedName := strings.TrimSpace(info.Name); trimmedName != "" {
		return trimmedName
	}
	return "Go Seller"
}

func (s *OrderService) getDefaultNotificationLocale(ctx context.Context) string {
	var item settingmodels.Setting
	if err := s.DB.WithContext(ctx).Where("scope = ? AND key = ?", "global", "i18n.default_locale").First(&item).Error; err != nil {
		return "id"
	}
	var locale string
	if err := json.Unmarshal(item.Value, &locale); err != nil {
		return "id"
	}
	return normalizeNotificationLocale(locale)
}

func (s *OrderService) buildDisputeNotificationPayload(ctx context.Context, order *models.Order, recipient orderNotificationRecipient) map[string]any {
	if order == nil {
		return map[string]any{}
	}
	locale := s.getDefaultNotificationLocale(ctx)

	customerName := "Customer"
	customerEmail := ""
	if order.Customer != nil {
		if trimmedName := strings.TrimSpace(order.Customer.Name); trimmedName != "" {
			customerName = trimmedName
		}
		customerEmail = strings.TrimSpace(order.Customer.Email)
	}

	paymentStatus := strings.TrimSpace(order.PaymentStatus)
	if len(order.Payments) > 0 && strings.TrimSpace(order.Payments[0].Status) != "" {
		paymentStatus = strings.TrimSpace(order.Payments[0].Status)
	}

	metadata := parseOrderMetadataRoot(order.Metadata)
	confirmation := readCustomerConfirmationMetadata(metadata)
	dispute := readOrderDisputeMetadata(metadata)
	businessID := ""
	if order.BusinessID != nil {
		businessID = strings.TrimSpace(*order.BusinessID)
	}

	return map[string]any{
		"order_id":                           order.ID,
		"order_number":                       order.OrderNumber,
		"order_status":                       order.Status,
		"payment_status":                     paymentStatus,
		"customer_name":                      customerName,
		"customer_email":                     customerEmail,
		"customer_locale":                    locale,
		"seller_email":                       strings.TrimSpace(recipient.Email),
		"seller_name":                        strings.TrimSpace(recipient.Name),
		"business_name":                      s.lookupBusinessName(ctx, businessID),
		"confirmation_status":                strings.TrimSpace(confirmation.Status),
		"confirmation_message":               valueOrEmpty(confirmation.SellerMessage),
		"confirmation_reject_reason":         valueOrEmpty(confirmation.RejectReason),
		"dispute_customer_reason":            valueOrEmpty(dispute.CustomerReason),
		"dispute_seller_note":                valueOrEmpty(dispute.SellerNote),
		"dispute_admin_decision":             strings.TrimSpace(dispute.AdminDecision),
		"dispute_admin_note":                 valueOrEmpty(dispute.AdminNote),
		"dispute_refund_note":                valueOrEmpty(dispute.RefundNote),
		"dispute_confirmation_reject_reason": valueOrEmpty(confirmation.RejectReason),
		"order_link":                         "/member/orders",
	}
}

func (s *OrderService) sendDisputeMemberEventAsync(ctx context.Context, order *models.Order, eventKey string) {
	if order == nil || order.BusinessID == nil {
		return
	}
	businessID := strings.TrimSpace(*order.BusinessID)
	if businessID == "" {
		return
	}

	recipients, err := s.loadBusinessNotificationRecipients(ctx, businessID, eventKey)
	if err != nil || len(recipients) == 0 {
		owner, ownerErr := s.lookupBusinessNotificationOwner(ctx, businessID)
		if ownerErr == nil && strings.TrimSpace(owner.Email) != "" {
			recipients = []orderNotificationRecipient{owner}
		}
	}
	for _, recipient := range recipients {
		if strings.TrimSpace(recipient.Email) == "" {
			continue
		}
		payload := s.buildDisputeNotificationPayload(ctx, order, recipient)
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, eventKey+"_member", payload)
	}
}

func (s *OrderService) sendDisputeOpenedNotifications(ctx context.Context, order *models.Order) {
	if order == nil {
		return
	}
	pluginregistry.SendOrderEventAsync(ctx, s.DB, "order_dispute_opened_admin", order.ID)
	s.sendDisputeMemberEventAsync(ctx, order, "order_dispute_opened")
}

func (s *OrderService) sendDisputeSellerWonNotifications(ctx context.Context, order *models.Order) {
	if order == nil {
		return
	}
	pluginregistry.SendOrderEventAsync(ctx, s.DB, "order_dispute_seller_won_customer", order.ID)
	s.sendDisputeMemberEventAsync(ctx, order, "order_dispute_seller_won")
}

func (s *OrderService) sendDisputeCustomerWonNotifications(ctx context.Context, order *models.Order) {
	if order == nil {
		return
	}
	pluginregistry.SendOrderEventAsync(ctx, s.DB, "order_dispute_customer_won_customer", order.ID)
	s.sendDisputeMemberEventAsync(ctx, order, "order_dispute_customer_won")
}

func (s *OrderService) sendDisputeRefundedNotifications(ctx context.Context, order *models.Order) {
	if order == nil {
		return
	}
	pluginregistry.SendOrderEventAsync(ctx, s.DB, "order_dispute_refunded_customer", order.ID)
	s.sendDisputeMemberEventAsync(ctx, order, "order_dispute_refunded")
}

func (s *OrderService) hasEligibleCustomerConfirmationShipmentTx(tx *gorm.DB, order *models.Order) (bool, error) {
	if order == nil {
		return false, nil
	}
	progress, err := loadOrderShipmentProgressTx(tx, order.ID)
	if err != nil {
		return false, err
	}
	return canRequestCustomerConfirmation(order.FulfillmentType, progress), nil
}

func (s *OrderService) creditCompletedOrderTx(tx *gorm.DB, order *models.Order, now time.Time) error {
	if tx == nil || order == nil || order.BusinessID == nil {
		return nil
	}
	if !strings.EqualFold(strings.TrimSpace(order.PaymentStatus), "paid") {
		return nil
	}
	sellerID := strings.TrimSpace(*order.BusinessID)
	if sellerID == "" {
		return nil
	}
	amount := int64(order.GrandTotal * 100)
	if amount <= 0 {
		return nil
	}
	refType := models.ReferenceTypeOrder
	var existingCount int64
	if err := tx.Model(&models.SellerBalanceMutation{}).
		Where("seller_id = ? AND mutation_type = ? AND source = ? AND reference_type = ? AND reference_id = ?", sellerID, models.MutationTypeCredit, models.SourceOrder, refType, order.ID).
		Count(&existingCount).Error; err != nil {
		return err
	}
	if existingCount > 0 {
		return nil
	}

	var balance models.SellerBalance
	if err := tx.Where("seller_id = ?", sellerID).First(&balance).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("failed to load seller balance: %w", err)
		}
		balance = models.SellerBalance{
			SellerID:  sellerID,
			Balance:   0,
			UpdatedAt: now,
		}
		if err := tx.Create(&balance).Error; err != nil {
			return fmt.Errorf("failed to initialize seller balance: %w", err)
		}
	}

	newBalance := balance.Balance + amount
	if err := tx.Model(&balance).Updates(map[string]any{"balance": newBalance, "updated_at": now}).Error; err != nil {
		return fmt.Errorf("failed to update seller balance: %w", err)
	}

	referenceID := order.ID
	description := fmt.Sprintf("Payment for order %s", order.ID)
	mutation := models.SellerBalanceMutation{
		SellerID:      sellerID,
		MutationType:  models.MutationTypeCredit,
		Amount:        amount,
		Source:        models.SourceOrder,
		ReferenceID:   &referenceID,
		ReferenceType: &refType,
		Description:   &description,
		BalanceAfter:  newBalance,
		CreatedAt:     now,
	}
	if err := tx.Create(&mutation).Error; err != nil {
		return fmt.Errorf("failed to create seller balance mutation: %w", err)
	}
	return nil
}

func (s *OrderService) RequestCustomerConfirmation(ctx context.Context, orderID string, message *string) (*models.Order, error) {
	featureEnabled, err := s.isCustomerConfirmationFeatureEnabled(ctx)
	if err != nil {
		return nil, err
	}
	if !featureEnabled {
		return nil, ErrCustomerConfirmationDisabled
	}

	trimmedMessage := ""
	if message != nil {
		trimmedMessage = strings.TrimSpace(*message)
	}

	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		status := strings.ToLower(strings.TrimSpace(order.Status))
		if isOrderExpiredOrCancelled(order) || status == "completed" {
			return ErrCustomerConfirmationUnavailable
		}
		if !strings.EqualFold(strings.TrimSpace(order.PaymentStatus), "paid") {
			return ErrCustomerConfirmationUnavailable
		}
		eligibleShipment, err := s.hasEligibleCustomerConfirmationShipmentTx(tx, &order)
		if err != nil {
			return err
		}
		if !eligibleShipment {
			return ErrCustomerConfirmationUnavailable
		}

		metadata := parseOrderMetadataRoot(order.Metadata)
		confirmation := readCustomerConfirmationMetadata(metadata)
		confirmation.Status = "requested"
		confirmation.SellerMessage = normalizeOptionalText(trimmedMessage)
		confirmation.RequestedAt = &now
		confirmation.ApprovedAt = nil
		confirmation.RejectedAt = nil
		confirmation.RejectReason = nil
		metadata[customerConfirmationMetadataKey] = confirmation.toMap()
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"status":     OrderStatusWaitingCustomerConfirmation,
			"metadata":   metadataJSON,
			"updated_at": now,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "customer_confirmation_requested", orderID)
	return s.GetOrderByID(ctx, orderID)
}

func (s *OrderService) ApproveCustomerConfirmation(ctx context.Context, orderID string) (*models.Order, error) {
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(order.Status)) != OrderStatusWaitingCustomerConfirmation {
			return ErrCustomerConfirmationNotPending
		}

		metadata := parseOrderMetadataRoot(order.Metadata)
		confirmation := readCustomerConfirmationMetadata(metadata)
		confirmation.Status = "approved"
		confirmation.ApprovedAt = &now
		confirmation.RejectedAt = nil
		confirmation.RejectReason = nil
		metadata[customerConfirmationMetadataKey] = confirmation.toMap()
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		order.Status = "completed"
		order.Metadata = metadataJSON
		if err := tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"status":     "completed",
			"metadata":   metadataJSON,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}
		return s.creditCompletedOrderTx(tx, &order, now)
	})
	if err != nil {
		return nil, err
	}

	pluginregistry.SendOrderEventAsync(context.Background(), s.DB, "completed_order_customer", orderID)
	return s.GetOrderByID(ctx, orderID)
}

func (s *OrderService) RejectCustomerConfirmation(ctx context.Context, orderID string, reason string) (*models.Order, error) {
	trimmedReason := strings.TrimSpace(reason)
	if trimmedReason == "" {
		return nil, ErrCustomerConfirmationReasonRequired
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(order.Status)) != OrderStatusWaitingCustomerConfirmation {
			return ErrCustomerConfirmationNotPending
		}

		metadata := parseOrderMetadataRoot(order.Metadata)
		confirmation := readCustomerConfirmationMetadata(metadata)
		confirmation.Status = "rejected"
		confirmation.RejectedAt = &now
		confirmation.RejectReason = &trimmedReason
		confirmation.ApprovedAt = nil
		metadata[customerConfirmationMetadataKey] = confirmation.toMap()

		dispute := readOrderDisputeMetadata(metadata)
		dispute.OpenedAt = &now
		dispute.CustomerReason = &trimmedReason
		dispute.SellerNote = nil
		dispute.SellerNoteAt = nil
		dispute.SellerMemberID = nil
		dispute.AdminDecision = orderDisputeDecisionOpen
		dispute.AdminNote = nil
		dispute.ResolvedByAdminID = nil
		dispute.ResolvedAt = nil
		dispute.RefundNote = nil
		dispute.RefundCompletedByAdminID = nil
		dispute.RefundCompletedAt = nil
		metadata[orderDisputeMetadataKey] = dispute.toMap()
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"status":     OrderStatusInDispute,
			"metadata":   metadataJSON,
			"updated_at": now,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	s.sendDisputeOpenedNotifications(context.Background(), updated)
	return updated, nil
}

func (s *OrderService) UpsertSellerDisputeNote(ctx context.Context, orderID, memberID, note string) (*models.Order, error) {
	trimmedNote := strings.TrimSpace(note)
	if trimmedNote == "" {
		return nil, ErrOrderDisputeNoteRequired
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(order.Status)) != OrderStatusInDispute {
			return ErrOrderDisputeNotOpen
		}

		metadata := parseOrderMetadataRoot(order.Metadata)
		dispute := readOrderDisputeMetadata(metadata)
		decision := normalizeDisputeDecision(dispute.AdminDecision)
		if decision != "" && decision != orderDisputeDecisionOpen {
			return ErrOrderDisputeAlreadyResolved
		}
		if dispute.OpenedAt == nil {
			dispute.OpenedAt = &now
		}
		if decision == "" {
			dispute.AdminDecision = orderDisputeDecisionOpen
		}
		dispute.SellerNote = &trimmedNote
		dispute.SellerNoteAt = &now
		dispute.SellerMemberID = normalizeOptionalText(memberID)
		metadata[orderDisputeMetadataKey] = dispute.toMap()
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"metadata":   metadataJSON,
			"updated_at": now,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	return s.GetOrderByID(ctx, orderID)
}

func (s *OrderService) ResolveDisputeForSeller(ctx context.Context, orderID, adminID, adminNote string) (*models.Order, error) {
	trimmedAdminNote := strings.TrimSpace(adminNote)
	if trimmedAdminNote == "" {
		return nil, ErrOrderDisputeAdminNoteRequired
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(order.Status)) != OrderStatusInDispute {
			return ErrOrderDisputeNotOpen
		}

		metadata := parseOrderMetadataRoot(order.Metadata)
		dispute := readOrderDisputeMetadata(metadata)
		decision := normalizeDisputeDecision(dispute.AdminDecision)
		if decision != "" && decision != orderDisputeDecisionOpen {
			return ErrOrderDisputeAlreadyResolved
		}
		if dispute.OpenedAt == nil {
			dispute.OpenedAt = &now
		}
		dispute.AdminDecision = orderDisputeDecisionSellerWon
		dispute.AdminNote = &trimmedAdminNote
		dispute.ResolvedByAdminID = normalizeOptionalText(adminID)
		dispute.ResolvedAt = &now
		dispute.RefundNote = nil
		dispute.RefundCompletedByAdminID = nil
		dispute.RefundCompletedAt = nil
		metadata[orderDisputeMetadataKey] = dispute.toMap()
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		order.Status = "completed"
		order.Metadata = metadataJSON
		if err := tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"status":     "completed",
			"metadata":   metadataJSON,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}
		return s.creditCompletedOrderTx(tx, &order, now)
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	s.sendDisputeSellerWonNotifications(context.Background(), updated)
	return updated, nil
}

func (s *OrderService) ResolveDisputeForCustomer(ctx context.Context, orderID, adminID, adminNote string) (*models.Order, error) {
	trimmedAdminNote := strings.TrimSpace(adminNote)
	if trimmedAdminNote == "" {
		return nil, ErrOrderDisputeAdminNoteRequired
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(order.Status)) != OrderStatusInDispute {
			return ErrOrderDisputeNotOpen
		}

		metadata := parseOrderMetadataRoot(order.Metadata)
		dispute := readOrderDisputeMetadata(metadata)
		decision := normalizeDisputeDecision(dispute.AdminDecision)
		if decision != "" && decision != orderDisputeDecisionOpen {
			return ErrOrderDisputeAlreadyResolved
		}
		if dispute.OpenedAt == nil {
			dispute.OpenedAt = &now
		}
		dispute.AdminDecision = orderDisputeDecisionCustomerWon
		dispute.AdminNote = &trimmedAdminNote
		dispute.ResolvedByAdminID = normalizeOptionalText(adminID)
		dispute.ResolvedAt = &now
		metadata[orderDisputeMetadataKey] = dispute.toMap()
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"metadata":   metadataJSON,
			"updated_at": now,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	s.sendDisputeCustomerWonNotifications(context.Background(), updated)
	return updated, nil
}

func (s *OrderService) MarkDisputeRefundCompleted(ctx context.Context, orderID, adminID, refundNote string) (*models.Order, error) {
	trimmedRefundNote := strings.TrimSpace(refundNote)
	if trimmedRefundNote == "" {
		return nil, ErrOrderDisputeRefundNoteRequired
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var order models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(order.Status)) != OrderStatusInDispute {
			return ErrOrderDisputeRefundNotPending
		}

		metadata := parseOrderMetadataRoot(order.Metadata)
		dispute := readOrderDisputeMetadata(metadata)
		if normalizeDisputeDecision(dispute.AdminDecision) != orderDisputeDecisionCustomerWon {
			return ErrOrderDisputeRefundNotPending
		}
		dispute.AdminDecision = orderDisputeDecisionRefunded
		dispute.RefundNote = &trimmedRefundNote
		dispute.RefundCompletedByAdminID = normalizeOptionalText(adminID)
		dispute.RefundCompletedAt = &now
		metadata[orderDisputeMetadataKey] = dispute.toMap()
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return err
		}

		return tx.Model(&models.Order{}).Where("id = ?", orderID).Updates(map[string]any{
			"status":         OrderStatusRefunded,
			"payment_status": OrderStatusRefunded,
			"metadata":       metadataJSON,
			"updated_at":     now,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	s.sendDisputeRefundedNotifications(context.Background(), updated)
	return updated, nil
}
