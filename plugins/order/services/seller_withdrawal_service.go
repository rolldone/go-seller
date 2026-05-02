package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go_framework/internal/db"
	"go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"

	"gorm.io/gorm"
)

type SellerWithdrawalService struct {
	DB                   *gorm.DB
	SellerBalanceService *SellerBalanceService
}

func NewSellerWithdrawalService(dbConn *gorm.DB, sbService *SellerBalanceService) *SellerWithdrawalService {
	return &SellerWithdrawalService{DB: dbConn, SellerBalanceService: sbService}
}

// sellerOwnerInfo holds the business owner's contact and locale info for notifications.
type sellerOwnerInfo struct {
	Email    string
	Name     string
	Language string
}

// lookupSellerOwner fetches the owning member's email, name, and language for a business.
func (s *SellerWithdrawalService) lookupSellerOwner(ctx context.Context, businessID string) (sellerOwnerInfo, error) {
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
	lang := info.Language
	if lang == "" {
		lang = "id"
	}
	return sellerOwnerInfo{Email: info.Email, Name: info.FullName, Language: lang}, nil
}

func formatIDRCents(cents int64) string {
	idr := cents / 100
	return fmt.Sprintf("Rp %d", idr)
}

func buildWithdrawalPayload(owner sellerOwnerInfo, w *models.SellerWithdrawal, adminNotes string) map[string]interface{} {
	p := map[string]interface{}{
		"seller_email":        owner.Email,
		"seller_name":         owner.Name,
		"customer_locale":     owner.Language,
		"withdrawal_id":       fmt.Sprintf("%d", w.ID),
		"amount":              formatIDRCents(w.Amount),
		"bank_name":           w.BankName,
		"bank_account_number": w.BankAccountNumber,
		"bank_account_name":   w.BankAccountName,
		"admin_notes":         adminNotes,
	}
	return p
}

func (s *SellerWithdrawalService) lookupBusinessName(ctx context.Context, businessID string) string {
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

func (s *SellerWithdrawalService) loadGroupRecipients(ctx context.Context, businessID string, eventKey string) ([]sellerOwnerInfo, error) {
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
		if _, ok := seen[key]; ok {
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

// sendWithdrawalNotifToGroups sends withdrawal notifications to group members first,
// then falls back to the business owner, and finally to admin if no owner exists.
func (s *SellerWithdrawalService) sendWithdrawalNotifToGroups(ctx context.Context, businessID string, eventKey string, withdrawal *models.SellerWithdrawal, adminNotes string) {
	recipients, err := s.loadGroupRecipients(ctx, businessID, eventKey)
	if err == nil && len(recipients) > 0 {
		for _, recipient := range recipients {
			payload := buildWithdrawalPayload(recipient, withdrawal, adminNotes)
			pluginregistry.SendTemplateEventAsync(ctx, s.DB, eventKey+"_member", payload)
		}
		return
	}

	if owner, err := s.lookupSellerOwner(ctx, businessID); err == nil && owner.Email != "" {
		payload := buildWithdrawalPayload(owner, withdrawal, adminNotes)
		pluginregistry.SendTemplateEventAsync(ctx, s.DB, eventKey+"_member", payload)
		return
	}

	businessName := s.lookupBusinessName(ctx, businessID)
	fallback := sellerOwnerInfo{Email: "", Name: businessName, Language: "id"}
	payload := buildWithdrawalPayload(fallback, withdrawal, adminNotes)
	pluginregistry.SendTemplateEventAsync(ctx, s.DB, eventKey+"_admin", payload)
}

type CreateWithdrawalInput struct {
	Amount            int64   `json:"amount"`
	BankName          string  `json:"bank_name"`
	BankAccountNumber string  `json:"bank_account_number"`
	BankAccountName   string  `json:"bank_account_name"`
	Notes             *string `json:"notes"`
}

func trimmedPtr(value string) *string {
	trimmed := value
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func trimOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := *value
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func (s *SellerWithdrawalService) appendAudit(tx *gorm.DB, withdrawalID int64, sellerID string, action string, actorType string, actorID *string, statusFrom *string, statusTo string, notes *string, createdAt time.Time) error {
	audit := &models.SellerWithdrawalAudit{
		WithdrawalID: withdrawalID,
		SellerID:     sellerID,
		Action:       action,
		ActorType:    actorType,
		ActorID:      actorID,
		StatusFrom:   statusFrom,
		StatusTo:     statusTo,
		Notes:        notes,
		CreatedAt:    createdAt,
	}
	if err := tx.Create(audit).Error; err != nil {
		return fmt.Errorf("failed to append withdrawal audit: %w", err)
	}
	return nil
}

// RequestWithdrawal creates a new withdrawal request and debets the seller balance
func (s *SellerWithdrawalService) RequestWithdrawal(ctx context.Context, sellerID string, in CreateWithdrawalInput) (*models.SellerWithdrawal, error) {
	if in.Amount <= 0 {
		return nil, errors.New("withdrawal amount must be positive")
	}
	if in.BankName == "" || in.BankAccountNumber == "" || in.BankAccountName == "" {
		return nil, errors.New("bank details are required")
	}

	var withdrawal *models.SellerWithdrawal

	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		// Check current balance
		var balance models.SellerBalance
		if err := tx.Where("seller_id = ?", sellerID).First(&balance).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("seller balance not found")
			}
			return fmt.Errorf("failed to get balance: %w", err)
		}

		if balance.Balance < in.Amount {
			return fmt.Errorf("insufficient balance: current=%d, requested=%d", balance.Balance, in.Amount)
		}

		// Deduct balance immediately (hold funds)
		newBalance := balance.Balance - in.Amount
		if err := tx.Model(&balance).Update("balance", newBalance).Update("updated_at", time.Now()).Error; err != nil {
			return fmt.Errorf("failed to update balance: %w", err)
		}

		// Create withdrawal record
		now := time.Now()
		withdrawal = &models.SellerWithdrawal{
			SellerID:          sellerID,
			Amount:            in.Amount,
			Status:            models.WithdrawalStatusPending,
			BankName:          in.BankName,
			BankAccountNumber: in.BankAccountNumber,
			BankAccountName:   in.BankAccountName,
			Notes:             in.Notes,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		if err := tx.Create(withdrawal).Error; err != nil {
			return fmt.Errorf("failed to create withdrawal: %w", err)
		}

		// Record mutation
		wdIDStr := fmt.Sprintf("%d", withdrawal.ID)
		wdType := models.ReferenceTypeWithdraw
		description := fmt.Sprintf("Withdrawal request #%d to %s %s", withdrawal.ID, in.BankName, in.BankAccountNumber)
		mutation := &models.SellerBalanceMutation{
			SellerID:      sellerID,
			MutationType:  models.MutationTypeDebet,
			Amount:        in.Amount,
			Source:        models.SourceWithdraw,
			ReferenceID:   &wdIDStr,
			ReferenceType: &wdType,
			Description:   &description,
			BalanceAfter:  newBalance,
			CreatedAt:     now,
		}
		if err := tx.Create(mutation).Error; err != nil {
			return fmt.Errorf("failed to record mutation: %w", err)
		}

		if err := s.appendAudit(
			tx,
			withdrawal.ID,
			sellerID,
			models.WithdrawalAuditActionRequested,
			"member",
			nil,
			nil,
			models.WithdrawalStatusPending,
			trimOptional(in.Notes),
			now,
		); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Send notifications (non-blocking)
	s.sendWithdrawalNotifToGroups(ctx, sellerID, "withdrawal_requested", withdrawal, "")

	return withdrawal, nil
}

// ApproveWithdrawal approves a pending withdrawal request
func (s *SellerWithdrawalService) ApproveWithdrawal(ctx context.Context, withdrawalID int64, adminID string, adminNotes *string) (*models.SellerWithdrawal, error) {
	var withdrawal models.SellerWithdrawal
	if err := s.DB.WithContext(ctx).First(&withdrawal, withdrawalID).Error; err != nil {
		return nil, fmt.Errorf("withdrawal not found: %w", err)
	}

	if withdrawal.Status != models.WithdrawalStatusPending {
		return nil, fmt.Errorf("withdrawal is not in pending status (current: %s)", withdrawal.Status)
	}

	now := time.Now()
	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"status":               models.WithdrawalStatusApproved,
			"admin_notes":          adminNotes,
			"reviewed_by_admin_id": adminID,
			"reviewed_at":          now,
			"updated_at":           now,
		}

		if err := tx.Model(&withdrawal).Updates(updates).Error; err != nil {
			return fmt.Errorf("failed to approve withdrawal: %w", err)
		}

		statusFrom := withdrawal.Status
		if err := s.appendAudit(
			tx,
			withdrawal.ID,
			withdrawal.SellerID,
			models.WithdrawalAuditActionApproved,
			"admin",
			trimmedPtr(adminID),
			&statusFrom,
			models.WithdrawalStatusApproved,
			trimOptional(adminNotes),
			now,
		); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	if err := s.DB.WithContext(ctx).First(&withdrawal, withdrawalID).Error; err != nil {
		return nil, err
	}

	// Send approval notification
	s.sendWithdrawalNotifToGroups(ctx, withdrawal.SellerID, "withdrawal_approved", &withdrawal, "")

	return &withdrawal, nil
}

// RejectWithdrawal rejects a pending withdrawal and refunds balance
func (s *SellerWithdrawalService) RejectWithdrawal(ctx context.Context, withdrawalID int64, adminID string, adminNotes *string) (*models.SellerWithdrawal, error) {
	var withdrawal models.SellerWithdrawal
	if err := s.DB.WithContext(ctx).First(&withdrawal, withdrawalID).Error; err != nil {
		return nil, fmt.Errorf("withdrawal not found: %w", err)
	}

	if withdrawal.Status != models.WithdrawalStatusPending && withdrawal.Status != models.WithdrawalStatusApproved {
		return nil, fmt.Errorf("withdrawal cannot be rejected (current status: %s)", withdrawal.Status)
	}

	now := time.Now()

	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		statusFrom := withdrawal.Status
		// Update withdrawal status
		updates := map[string]interface{}{
			"status":               models.WithdrawalStatusRejected,
			"admin_notes":          adminNotes,
			"reviewed_by_admin_id": adminID,
			"reviewed_at":          now,
			"updated_at":           now,
		}
		if err := tx.Model(&withdrawal).Updates(updates).Error; err != nil {
			return fmt.Errorf("failed to reject withdrawal: %w", err)
		}

		// Refund the balance
		var balance models.SellerBalance
		if err := tx.Where("seller_id = ?", withdrawal.SellerID).First(&balance).Error; err != nil {
			return fmt.Errorf("failed to get balance for refund: %w", err)
		}

		newBalance := balance.Balance + withdrawal.Amount
		if err := tx.Model(&balance).Update("balance", newBalance).Update("updated_at", now).Error; err != nil {
			return fmt.Errorf("failed to refund balance: %w", err)
		}

		// Record credit mutation for refund
		wdIDStr := fmt.Sprintf("%d", withdrawalID)
		wdType := models.ReferenceTypeWithdraw
		description := fmt.Sprintf("Refund for rejected withdrawal #%d", withdrawalID)
		mutation := &models.SellerBalanceMutation{
			SellerID:      withdrawal.SellerID,
			MutationType:  models.MutationTypeCredit,
			Amount:        withdrawal.Amount,
			Source:        models.SourceWithdraw,
			ReferenceID:   &wdIDStr,
			ReferenceType: &wdType,
			Description:   &description,
			BalanceAfter:  newBalance,
			CreatedAt:     now,
		}
		if err := tx.Create(mutation).Error; err != nil {
			return fmt.Errorf("failed to record refund mutation: %w", err)
		}

		if err := s.appendAudit(
			tx,
			withdrawal.ID,
			withdrawal.SellerID,
			models.WithdrawalAuditActionRejected,
			"admin",
			trimmedPtr(adminID),
			&statusFrom,
			models.WithdrawalStatusRejected,
			trimOptional(adminNotes),
			now,
		); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	if err := s.DB.WithContext(ctx).First(&withdrawal, withdrawalID).Error; err != nil {
		return nil, err
	}

	// Send rejection notification
	notes := ""
	if adminNotes != nil {
		notes = *adminNotes
	}
	s.sendWithdrawalNotifToGroups(ctx, withdrawal.SellerID, "withdrawal_rejected", &withdrawal, notes)

	return &withdrawal, nil
}

// MarkProcessed marks an approved withdrawal as processed (funds transferred)
func (s *SellerWithdrawalService) MarkProcessed(ctx context.Context, withdrawalID int64, adminID string, adminNotes *string) (*models.SellerWithdrawal, error) {
	var withdrawal models.SellerWithdrawal
	if err := s.DB.WithContext(ctx).First(&withdrawal, withdrawalID).Error; err != nil {
		return nil, fmt.Errorf("withdrawal not found: %w", err)
	}

	if withdrawal.Status != models.WithdrawalStatusApproved {
		return nil, fmt.Errorf("withdrawal must be approved before marking processed (current: %s)", withdrawal.Status)
	}

	now := time.Now()
	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"status":       models.WithdrawalStatusProcessed,
			"admin_notes":  adminNotes,
			"processed_at": now,
			"updated_at":   now,
		}

		if err := tx.Model(&withdrawal).Updates(updates).Error; err != nil {
			return fmt.Errorf("failed to mark processed: %w", err)
		}

		statusFrom := withdrawal.Status
		if err := s.appendAudit(
			tx,
			withdrawal.ID,
			withdrawal.SellerID,
			models.WithdrawalAuditActionProcessed,
			"admin",
			trimmedPtr(adminID),
			&statusFrom,
			models.WithdrawalStatusProcessed,
			trimOptional(adminNotes),
			now,
		); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	if err := s.DB.WithContext(ctx).First(&withdrawal, withdrawalID).Error; err != nil {
		return nil, err
	}

	// Send processed notification
	pNotes := ""
	if adminNotes != nil {
		pNotes = *adminNotes
	}
	s.sendWithdrawalNotifToGroups(ctx, withdrawal.SellerID, "withdrawal_processed", &withdrawal, pNotes)

	return &withdrawal, nil
}

// ListWithdrawals retrieves withdrawal history for a seller
func (s *SellerWithdrawalService) ListWithdrawals(ctx context.Context, sellerID string, status string, limit int, offset int) ([]models.SellerWithdrawal, int64, error) {
	var withdrawals []models.SellerWithdrawal
	var total int64

	q := s.DB.WithContext(ctx).Where("seller_id = ?", sellerID)
	if status != "" {
		q = q.Where("status = ?", status)
	}

	q.Model(&models.SellerWithdrawal{}).Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&withdrawals).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list withdrawals: %w", err)
	}

	return withdrawals, total, nil
}

// AdminListWithdrawals lists all withdrawal requests (admin view)
func (s *SellerWithdrawalService) AdminListWithdrawals(ctx context.Context, status string, limit int, offset int) ([]models.SellerWithdrawal, int64, error) {
	var withdrawals []models.SellerWithdrawal
	var total int64

	q := s.DB.WithContext(ctx)
	if status != "" {
		q = q.Where("status = ?", status)
	}

	q.Model(&models.SellerWithdrawal{}).Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&withdrawals).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list withdrawals: %w", err)
	}

	return withdrawals, total, nil
}

// GetWithdrawalByID retrieves a withdrawal by ID (checks seller ownership)
func (s *SellerWithdrawalService) GetWithdrawalByID(ctx context.Context, withdrawalID int64, sellerID string) (*models.SellerWithdrawal, error) {
	var withdrawal models.SellerWithdrawal
	q := s.DB.WithContext(ctx).Where("id = ?", withdrawalID)
	if sellerID != "" {
		q = q.Where("seller_id = ?", sellerID)
	}
	if err := q.First(&withdrawal).Error; err != nil {
		return nil, fmt.Errorf("withdrawal not found: %w", err)
	}
	return &withdrawal, nil
}

func (s *SellerWithdrawalService) ListWithdrawalAudits(ctx context.Context, withdrawalID int64) ([]models.SellerWithdrawalAudit, error) {
	var audits []models.SellerWithdrawalAudit
	if err := s.DB.WithContext(ctx).
		Where("withdrawal_id = ?", withdrawalID).
		Order("created_at ASC, id ASC").
		Find(&audits).Error; err != nil {
		return nil, fmt.Errorf("failed to list withdrawal audits: %w", err)
	}
	return audits, nil
}
