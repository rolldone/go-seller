package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go_framework/internal/db"
	"go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CreateSettlementInput struct {
	SellerID      string
	OrderID       string
	GrossAmount   int64
	Source        string
	ReferenceID   *string
	ReferenceType *string
	ReleaseScope  string
	Metadata      []byte
	CreatedAt     time.Time
}

type ListSettlementsInput struct {
	Status   string
	SellerID string
	OrderID  string
	FromDate *time.Time
	ToDate   *time.Time
	Limit    int
	Offset   int
}

type SellerSettlementSummary struct {
	AvailableBalance                 int64 `json:"available_balance"`
	TotalCount                       int64 `json:"total_count"`
	PendingCount                     int64 `json:"pending_count"`
	PendingAmount                    int64 `json:"pending_amount"`
	HeldCount                        int64 `json:"held_count"`
	HeldAmount                       int64 `json:"held_amount"`
	PartiallyReleasedCount           int64 `json:"partially_released_count"`
	PartiallyReleasedRemainingAmount int64 `json:"partially_released_remaining_amount"`
	ReleasedCount                    int64 `json:"released_count"`
	ReleasedAmount                   int64 `json:"released_amount"`
	RefundedCount                    int64 `json:"refunded_count"`
	RefundedAmount                   int64 `json:"refunded_amount"`
	LockedAmount                     int64 `json:"locked_amount"`
}

var lockedSettlementStatuses = []string{
	models.SettlementStatusPending,
	models.SettlementStatusHeld,
	models.SettlementStatusPartiallyReleased,
}

func normalizeSettlementMetadata(raw []byte) []byte {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || strings.EqualFold(trimmed, "null") {
		return []byte("{}")
	}
	return []byte(trimmed)
}

func normalizeSettlementStatusFilter(raw string) []string {
	seen := make(map[string]struct{})
	statuses := make([]string, 0)
	parts := strings.Split(strings.ToLower(strings.TrimSpace(raw)), ",")
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}

		candidates := []string{trimmed}
		if trimmed == "locked" {
			candidates = lockedSettlementStatuses
		}

		for _, candidate := range candidates {
			if _, ok := seen[candidate]; ok {
				continue
			}
			seen[candidate] = struct{}{}
			statuses = append(statuses, candidate)
		}
	}

	return statuses
}

func (s *SellerBalanceService) CreatePendingSettlement(ctx context.Context, input CreateSettlementInput) (*models.SellerSettlement, error) {
	var settlement *models.SellerSettlement
	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		created, err := s.CreatePendingSettlementTx(tx, input)
		if err != nil {
			return err
		}
		settlement = created
		return nil
	})
	if err != nil {
		return nil, err
	}
	return settlement, nil
}

func (s *SellerBalanceService) CreatePendingSettlementTx(tx *gorm.DB, input CreateSettlementInput) (*models.SellerSettlement, error) {
	if tx == nil {
		return nil, errors.New("transaction is required")
	}
	if strings.TrimSpace(input.SellerID) == "" {
		return nil, errors.New("seller id is required")
	}
	if strings.TrimSpace(input.OrderID) == "" {
		return nil, errors.New("order id is required")
	}
	if input.GrossAmount <= 0 {
		return nil, errors.New("gross amount must be positive")
	}

	releaseScope := strings.ToLower(strings.TrimSpace(input.ReleaseScope))
	if releaseScope == "" {
		releaseScope = models.SettlementScopeFull
	}
	if input.CreatedAt.IsZero() {
		input.CreatedAt = time.Now()
	}
	metadata := normalizeSettlementMetadata(input.Metadata)
	source := strings.ToLower(strings.TrimSpace(input.Source))
	if source == "" {
		source = models.SettlementSourceOrder
	}

	var existing models.SellerSettlement
	result := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("order_id = ?", input.OrderID).First(&existing)
	if result.Error == nil {
		return &existing, nil
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check existing settlement: %w", result.Error)
	}

	settlement := &models.SellerSettlement{
		SellerID:       strings.TrimSpace(input.SellerID),
		OrderID:        strings.TrimSpace(input.OrderID),
		GrossAmount:    input.GrossAmount,
		ReleasedAmount: 0,
		ReleaseScope:   releaseScope,
		Status:         models.SettlementStatusPending,
		Source:         source,
		ReferenceID:    input.ReferenceID,
		ReferenceType:  input.ReferenceType,
		Metadata:       metadata,
		CreatedAt:      input.CreatedAt,
		UpdatedAt:      input.CreatedAt,
	}
	if settlement.ReferenceID == nil {
		referenceID := strings.TrimSpace(input.OrderID)
		settlement.ReferenceID = &referenceID
	}
	if settlement.ReferenceType == nil {
		referenceType := models.ReferenceTypeOrder
		settlement.ReferenceType = &referenceType
	}

	if err := tx.Create(settlement).Error; err != nil {
		return nil, fmt.Errorf("failed to create pending settlement: %w", err)
	}
	return settlement, nil
}

func (s *SellerBalanceService) GetSettlementByID(ctx context.Context, settlementID int64) (*models.SellerSettlement, error) {
	var settlement models.SellerSettlement
	if err := s.DB.WithContext(ctx).First(&settlement, settlementID).Error; err != nil {
		return nil, err
	}
	return &settlement, nil
}

func (s *SellerBalanceService) ListSettlements(ctx context.Context, input ListSettlementsInput) ([]models.SellerSettlement, int64, error) {
	query := s.DB.WithContext(ctx).Model(&models.SellerSettlement{})
	if statuses := normalizeSettlementStatusFilter(input.Status); len(statuses) == 1 {
		query = query.Where("status = ?", statuses[0])
	} else if len(statuses) > 1 {
		query = query.Where("status IN ?", statuses)
	}
	if trimmed := strings.TrimSpace(input.SellerID); trimmed != "" {
		query = query.Where("seller_id = ?", trimmed)
	}
	if trimmed := strings.TrimSpace(input.OrderID); trimmed != "" {
		query = query.Where("order_id = ?", trimmed)
	}
	if input.FromDate != nil {
		query = query.Where("created_at >= ?", input.FromDate.UTC())
	}
	if input.ToDate != nil {
		query = query.Where("created_at <= ?", input.ToDate.UTC())
	}

	limit := input.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var settlements []models.SellerSettlement
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&settlements).Error; err != nil {
		return nil, 0, err
	}

	return settlements, total, nil
}

func (s *SellerBalanceService) GetSettlementSummary(ctx context.Context, sellerID string) (*SellerSettlementSummary, error) {
	trimmedSellerID := strings.TrimSpace(sellerID)
	if trimmedSellerID == "" {
		return nil, errors.New("seller id is required")
	}

	balance, err := s.GetSellerBalance(ctx, trimmedSellerID)
	if err != nil {
		return nil, err
	}

	type summaryRow struct {
		TotalCount                       int64
		PendingCount                     int64
		PendingAmount                    int64
		HeldCount                        int64
		HeldAmount                       int64
		PartiallyReleasedCount           int64
		PartiallyReleasedRemainingAmount int64
		ReleasedCount                    int64
		ReleasedAmount                   int64
		RefundedCount                    int64
		RefundedAmount                   int64
	}

	var row summaryRow
	const query = `
SELECT
	COALESCE(COUNT(*), 0) AS total_count,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS pending_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount ELSE 0 END), 0) AS pending_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS held_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount ELSE 0 END), 0) AS held_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS partially_released_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount - released_amount ELSE 0 END), 0) AS partially_released_remaining_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS released_count,
	COALESCE(SUM(CASE WHEN status = ? THEN released_amount ELSE 0 END), 0) AS released_amount,
	COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS refunded_count,
	COALESCE(SUM(CASE WHEN status = ? THEN gross_amount ELSE 0 END), 0) AS refunded_amount
FROM seller_settlements
WHERE seller_id = ?`
	if err := s.DB.WithContext(ctx).Raw(
		query,
		models.SettlementStatusPending,
		models.SettlementStatusPending,
		models.SettlementStatusHeld,
		models.SettlementStatusHeld,
		models.SettlementStatusPartiallyReleased,
		models.SettlementStatusPartiallyReleased,
		models.SettlementStatusReleased,
		models.SettlementStatusReleased,
		models.SettlementStatusRefunded,
		models.SettlementStatusRefunded,
		trimmedSellerID,
	).Scan(&row).Error; err != nil {
		return nil, fmt.Errorf("failed to get settlement summary: %w", err)
	}

	summary := &SellerSettlementSummary{
		AvailableBalance:                 balance.Balance,
		TotalCount:                       row.TotalCount,
		PendingCount:                     row.PendingCount,
		PendingAmount:                    row.PendingAmount,
		HeldCount:                        row.HeldCount,
		HeldAmount:                       row.HeldAmount,
		PartiallyReleasedCount:           row.PartiallyReleasedCount,
		PartiallyReleasedRemainingAmount: row.PartiallyReleasedRemainingAmount,
		ReleasedCount:                    row.ReleasedCount,
		ReleasedAmount:                   row.ReleasedAmount,
		RefundedCount:                    row.RefundedCount,
		RefundedAmount:                   row.RefundedAmount,
	}
	summary.LockedAmount = summary.PendingAmount + summary.HeldAmount + summary.PartiallyReleasedRemainingAmount
	return summary, nil
}

type SettlementDecisionInput struct {
	Decision      string
	ReleaseAmount *int64
	AdminID       string
	AdminNote     *string
	Metadata      []byte
}

func normalizeSettlementDecision(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func (s *SellerBalanceService) DecideSettlement(ctx context.Context, settlementID int64, input SettlementDecisionInput) (*models.SellerSettlement, *models.SellerBalanceMutation, error) {
	var decided *models.SellerSettlement
	var mutation *models.SellerBalanceMutation
	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		updated, createdMutation, err := s.DecideSettlementTx(tx, settlementID, input)
		if err != nil {
			return err
		}
		decided = updated
		mutation = createdMutation
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	s.sendSettlementNotifToGroups(ctx, decided, mutation, input.AdminNote)
	return decided, mutation, nil
}

func (s *SellerBalanceService) DecideSettlementTx(tx *gorm.DB, settlementID int64, input SettlementDecisionInput) (*models.SellerSettlement, *models.SellerBalanceMutation, error) {
	if tx == nil {
		return nil, nil, errors.New("transaction is required")
	}
	if strings.TrimSpace(input.AdminID) == "" {
		return nil, nil, errors.New("admin id is required")
	}

	decision := normalizeSettlementDecision(input.Decision)
	switch decision {
	case models.SettlementDecisionHold, models.SettlementDecisionRelease, models.SettlementDecisionPartialRelease, models.SettlementDecisionRefund:
	default:
		return nil, nil, fmt.Errorf("invalid settlement decision: %s", input.Decision)
	}

	now := time.Now()
	var settlement models.SellerSettlement
	var mutation *models.SellerBalanceMutation
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&settlement, settlementID).Error; err != nil {
		return nil, nil, err
	}

	if settlement.Status == models.SettlementStatusReleased || settlement.Status == models.SettlementStatusRefunded || settlement.Status == models.SettlementStatusReversed {
		return nil, nil, fmt.Errorf("settlement already finalized")
	}

	if len(input.Metadata) > 0 {
		settlement.Metadata = normalizeSettlementMetadata(input.Metadata)
	}
	adminID := strings.TrimSpace(input.AdminID)
	settlement.AdminID = normalizeOptionalText(input.AdminID)
	settlement.AdminNote = input.AdminNote
	settlement.DecidedAt = &now
	settlement.UpdatedAt = now

	switch decision {
	case models.SettlementDecisionHold:
		settlement.Status = models.SettlementStatusHeld
		settlement.ReleaseScope = models.SettlementScopeHold
		settlement.ReleasedAt = nil
		metadataWithAudit, err := appendSettlementDecisionAudit(settlement.Metadata, settlementDecisionAuditEntry{
			DecidedAt:           now,
			Decision:            decision,
			AdminID:             adminID,
			AdminNote:           input.AdminNote,
			ReleaseAmount:       0,
			ReleasedAmountAfter: settlement.ReleasedAmount,
			StatusAfter:         settlement.Status,
			ReleaseScopeAfter:   settlement.ReleaseScope,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("failed to append settlement audit metadata: %w", err)
		}
		settlement.Metadata = metadataWithAudit
		if err := tx.Model(&models.SellerSettlement{}).Where("id = ?", settlement.ID).Updates(map[string]any{
			"status":        settlement.Status,
			"release_scope": settlement.ReleaseScope,
			"admin_id":      settlement.AdminID,
			"admin_note":    settlement.AdminNote,
			"decided_at":    settlement.DecidedAt,
			"updated_at":    settlement.UpdatedAt,
			"metadata":      settlement.Metadata,
		}).Error; err != nil {
			return nil, nil, fmt.Errorf("failed to hold settlement: %w", err)
		}
		return &settlement, nil, nil
	case models.SettlementDecisionRefund:
		if settlement.ReleasedAmount > 0 {
			return nil, nil, fmt.Errorf("refund after release is not supported yet")
		}
		settlement.Status = models.SettlementStatusRefunded
		settlement.ReleaseScope = models.SettlementScopeRefund
		settlement.ReleasedAt = nil
		metadataWithAudit, err := appendSettlementDecisionAudit(settlement.Metadata, settlementDecisionAuditEntry{
			DecidedAt:           now,
			Decision:            decision,
			AdminID:             adminID,
			AdminNote:           input.AdminNote,
			ReleaseAmount:       0,
			ReleasedAmountAfter: settlement.ReleasedAmount,
			StatusAfter:         settlement.Status,
			ReleaseScopeAfter:   settlement.ReleaseScope,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("failed to append settlement audit metadata: %w", err)
		}
		settlement.Metadata = metadataWithAudit
		if err := tx.Model(&models.SellerSettlement{}).Where("id = ?", settlement.ID).Updates(map[string]any{
			"status":        settlement.Status,
			"release_scope": settlement.ReleaseScope,
			"admin_id":      settlement.AdminID,
			"admin_note":    settlement.AdminNote,
			"decided_at":    settlement.DecidedAt,
			"updated_at":    settlement.UpdatedAt,
			"metadata":      settlement.Metadata,
		}).Error; err != nil {
			return nil, nil, fmt.Errorf("failed to mark settlement refunded: %w", err)
		}
		return &settlement, nil, nil
	case models.SettlementDecisionRelease, models.SettlementDecisionPartialRelease:
		remaining := settlement.GrossAmount - settlement.ReleasedAmount
		if remaining <= 0 {
			return nil, nil, fmt.Errorf("settlement already fully released")
		}
		releaseAmount := remaining
		if input.ReleaseAmount != nil {
			releaseAmount = *input.ReleaseAmount
		}
		if releaseAmount <= 0 {
			return nil, nil, fmt.Errorf("release amount must be positive")
		}
		if releaseAmount > remaining {
			return nil, nil, fmt.Errorf("release amount exceeds remaining settlement amount")
		}

		releaseScope := models.SettlementScopeFull
		if releaseAmount < remaining || decision == models.SettlementDecisionPartialRelease {
			releaseScope = models.SettlementScopePartial
		}
		// Use tranche-specific reference ID so each valid partial release gets its own
		// ledger mutation while still remaining idempotent for the same tranche.
		nextReleasedAmount := settlement.ReleasedAmount + releaseAmount
		referenceID := fmt.Sprintf("%d:%d", settlement.ID, nextReleasedAmount)
		referenceType := models.ReferenceTypeSettlement
		description := fmt.Sprintf("Settlement release for order %s", settlement.OrderID)
		createdMutation, err := s.creditBalanceTx(tx, settlement.SellerID, releaseAmount, models.SourceSettlement, &referenceID, &referenceType, &description)
		if err != nil {
			return nil, nil, err
		}
		mutation = createdMutation
		settlement.ReleasedAmount += releaseAmount
		settlement.ReleaseScope = releaseScope
		settlement.ReleasedAt = &now
		if settlement.ReleasedAmount >= settlement.GrossAmount {
			settlement.Status = models.SettlementStatusReleased
		} else {
			settlement.Status = models.SettlementStatusPartiallyReleased
		}
		var mutationID *int64
		if mutation != nil {
			mutationID = &mutation.ID
		}
		metadataWithAudit, err := appendSettlementDecisionAudit(settlement.Metadata, settlementDecisionAuditEntry{
			DecidedAt:           now,
			Decision:            decision,
			AdminID:             adminID,
			AdminNote:           input.AdminNote,
			ReleaseAmount:       releaseAmount,
			ReleasedAmountAfter: settlement.ReleasedAmount,
			StatusAfter:         settlement.Status,
			ReleaseScopeAfter:   settlement.ReleaseScope,
			MutationID:          mutationID,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("failed to append settlement audit metadata: %w", err)
		}
		settlement.Metadata = metadataWithAudit
		if err := tx.Model(&models.SellerSettlement{}).Where("id = ?", settlement.ID).Updates(map[string]any{
			"released_amount": settlement.ReleasedAmount,
			"release_scope":   settlement.ReleaseScope,
			"status":          settlement.Status,
			"admin_id":        settlement.AdminID,
			"admin_note":      settlement.AdminNote,
			"decided_at":      settlement.DecidedAt,
			"released_at":     settlement.ReleasedAt,
			"updated_at":      settlement.UpdatedAt,
			"metadata":        settlement.Metadata,
		}).Error; err != nil {
			return nil, nil, fmt.Errorf("failed to release settlement: %w", err)
		}
		return &settlement, mutation, nil
	}

	return nil, nil, fmt.Errorf("unsupported settlement decision")
}

func settlementMetadataSnapshot(orderID string, orderNumber string, trigger string, paymentStatus string, deliveryStatus string, grossAmount int64, releaseScope string, settledAt time.Time) ([]byte, error) {
	return json.Marshal(map[string]any{
		"order_id":        orderID,
		"order_number":    orderNumber,
		"trigger":         trigger,
		"payment_status":  paymentStatus,
		"delivery_status": deliveryStatus,
		"gross_amount":    grossAmount,
		"release_scope":   releaseScope,
		"settled_at":      settledAt.UTC().Format(time.RFC3339Nano),
	})
}

type settlementDecisionAuditEntry struct {
	DecidedAt           time.Time
	Decision            string
	AdminID             string
	AdminNote           *string
	ReleaseAmount       int64
	ReleasedAmountAfter int64
	StatusAfter         string
	ReleaseScopeAfter   string
	MutationID          *int64
}

func parseSettlementMetadataObject(raw []byte) map[string]any {
	normalized := normalizeSettlementMetadata(raw)
	root := map[string]any{}
	if err := json.Unmarshal(normalized, &root); err != nil {
		return map[string]any{}
	}
	return root
}

func appendSettlementDecisionAudit(raw []byte, entry settlementDecisionAuditEntry) ([]byte, error) {
	root := parseSettlementMetadataObject(raw)
	auditEntry := map[string]any{
		"decided_at":            entry.DecidedAt.UTC().Format(time.RFC3339Nano),
		"decision":              entry.Decision,
		"admin_id":              entry.AdminID,
		"release_amount":        entry.ReleaseAmount,
		"released_amount_after": entry.ReleasedAmountAfter,
		"status_after":          entry.StatusAfter,
		"release_scope_after":   entry.ReleaseScopeAfter,
	}
	if entry.AdminNote != nil {
		auditEntry["admin_note"] = strings.TrimSpace(*entry.AdminNote)
	}
	if entry.MutationID != nil {
		auditEntry["mutation_id"] = *entry.MutationID
	}

	const historyKey = "decision_history"
	history, _ := root[historyKey].([]any)
	history = append(history, auditEntry)
	root[historyKey] = history

	encoded, err := json.Marshal(root)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

func (s *SellerBalanceService) settlementEventKey(settlement *models.SellerSettlement) string {
	if settlement == nil {
		return ""
	}
	switch settlement.Status {
	case models.SettlementStatusHeld:
		return "settlement_held"
	case models.SettlementStatusPartiallyReleased:
		return "settlement_partially_released"
	case models.SettlementStatusReleased:
		return "settlement_released"
	case models.SettlementStatusRefunded:
		return "settlement_refunded"
	default:
		return ""
	}
}

func buildSettlementPayload(owner sellerOwnerInfo, settlement *models.SellerSettlement, mutation *models.SellerBalanceMutation, adminNotes string) map[string]interface{} {
	releaseAmount := int64(0)
	if mutation != nil {
		releaseAmount = mutation.Amount
	}
	remainingAmount := settlement.GrossAmount - settlement.ReleasedAmount
	if remainingAmount < 0 {
		remainingAmount = 0
	}
	return map[string]interface{}{
		"seller_email":     owner.Email,
		"seller_name":      owner.Name,
		"customer_locale":  owner.Language,
		"settlement_id":    fmt.Sprintf("%d", settlement.ID),
		"order_id":         settlement.OrderID,
		"status":           settlement.Status,
		"release_scope":    settlement.ReleaseScope,
		"gross_amount":     formatIDRCents(settlement.GrossAmount),
		"released_amount":  formatIDRCents(settlement.ReleasedAmount),
		"remaining_amount": formatIDRCents(remainingAmount),
		"release_amount":   formatIDRCents(releaseAmount),
		"admin_notes":      adminNotes,
	}
}

func (s *SellerBalanceService) lookupSettlementOwner(ctx context.Context, businessID string) (sellerOwnerInfo, error) {
	var info struct {
		Email    string
		FullName string
		Language string
	}
	err := s.DB.WithContext(ctx).
		Table("business_members bm").
		Joins("JOIN users u ON u.id = bm.user_id AND u.deleted_at IS NULL").
		Where("bm.business_id = ? AND bm.is_owner = true AND bm.deleted_at IS NULL", businessID).
		Select("u.email, u.full_name, u.language").
		Limit(1).
		Scan(&info).Error
	if err != nil {
		return sellerOwnerInfo{}, err
	}
	lang := strings.TrimSpace(strings.ToLower(info.Language))
	if lang != "en" {
		lang = "id"
	}
	return sellerOwnerInfo{Email: info.Email, Name: info.FullName, Language: lang}, nil
}

func (s *SellerBalanceService) lookupSettlementBusinessName(ctx context.Context, businessID string) string {
	var info struct {
		Name string
	}
	if err := s.DB.WithContext(ctx).
		Table("businesses").
		Where("id = ?", businessID).
		Select("name").
		Limit(1).
		Scan(&info).Error; err != nil {
		return businessID
	}
	name := strings.TrimSpace(info.Name)
	if name == "" {
		return businessID
	}
	return name
}

func (s *SellerBalanceService) loadSettlementGroupRecipients(ctx context.Context, businessID string, eventKey string) ([]sellerOwnerInfo, error) {
	var groups []models.MemberNotificationGroup
	if err := s.DB.WithContext(ctx).
		Where("business_id = ? AND is_active = true", businessID).
		Find(&groups).Error; err != nil {
		return nil, err
	}
	groupIDs := make([]int64, 0, len(groups))
	for _, g := range groups {
		if !g.MatchesEvent(eventKey) {
			continue
		}
		groupIDs = append(groupIDs, g.ID)
	}
	if len(groupIDs) == 0 {
		return nil, nil
	}

	type recipientRow struct {
		Email    string
		FullName string
		Language string
	}
	var rows []recipientRow
	if err := s.DB.WithContext(ctx).
		Table("member_notification_group_members mngm").
		Joins("JOIN users u ON u.id = mngm.user_id AND u.deleted_at IS NULL").
		Joins("JOIN business_members bm ON bm.user_id = u.id AND bm.business_id = ? AND bm.deleted_at IS NULL", businessID).
		Where("mngm.group_id IN ?", groupIDs).
		Select("DISTINCT LOWER(u.email) AS email, COALESCE(NULLIF(u.full_name, ''), u.email) AS full_name, COALESCE(NULLIF(u.language, ''), 'id') AS language").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	recipients := make([]sellerOwnerInfo, 0, len(rows))
	seen := map[string]struct{}{}
	for _, row := range rows {
		email := strings.TrimSpace(row.Email)
		if email == "" {
			continue
		}
		key := strings.ToLower(email)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		language := strings.ToLower(strings.TrimSpace(row.Language))
		if language != "en" {
			language = "id"
		}
		recipients = append(recipients, sellerOwnerInfo{
			Email:    email,
			Name:     strings.TrimSpace(row.FullName),
			Language: language,
		})
	}
	return recipients, nil
}

func (s *SellerBalanceService) sendSettlementNotifToGroups(ctx context.Context, settlement *models.SellerSettlement, mutation *models.SellerBalanceMutation, adminNotes *string) {
	eventKey := s.settlementEventKey(settlement)
	if eventKey == "" || settlement == nil {
		return
	}
	note := ""
	if adminNotes != nil {
		note = strings.TrimSpace(*adminNotes)
	}
	recipients, err := s.loadSettlementGroupRecipients(ctx, settlement.SellerID, eventKey)
	if err == nil && len(recipients) > 0 {
		for _, recipient := range recipients {
			payload := buildSettlementPayload(recipient, settlement, mutation, note)
			pluginregistry.SendTemplateEventAsync(ctx, s.DB, eventKey+"_member", payload)
		}
		return
	}

	if owner, err := s.lookupSettlementOwner(ctx, settlement.SellerID); err == nil && strings.TrimSpace(owner.Email) != "" {
		payload := buildSettlementPayload(owner, settlement, mutation, note)
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, eventKey+"_member", payload)
		return
	}

	businessName := s.lookupSettlementBusinessName(ctx, settlement.SellerID)
	fallback := sellerOwnerInfo{Email: "", Name: businessName, Language: "id"}
	payload := buildSettlementPayload(fallback, settlement, mutation, note)
	pluginregistry.SendTemplateEventAsync(ctx, s.DB, eventKey+"_admin", payload)
}
