package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"go_framework/internal/db"
	internaluuid "go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	ordermodels "go_framework/plugins/order/models"
	reviewmodels "go_framework/plugins/review/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrComplaintCaseNotFound = errors.New("complaint case not found")
var ErrComplaintOrderNotFound = errors.New("order not found")
var ErrComplaintNotOwned = errors.New("order is not accessible")
var ErrComplaintCaseClosed = errors.New("complaint case is closed")
var ErrComplaintSubjectRequired = errors.New("complaint subject is required")
var ErrComplaintBodyRequired = errors.New("complaint message is required")

type ComplaintCaseDetail struct {
	Case         *reviewmodels.ComplaintCase         `json:"case"`
	Messages     []reviewmodels.ComplaintMessage     `json:"messages"`
	Participants []reviewmodels.ComplaintParticipant `json:"participants"`
}

type CreateComplaintInput struct {
	OrderID    string
	CustomerID string
	Subject    string
	Body       string
}

type ComplaintMessageInput struct {
	SenderType string
	SenderID   string
	SenderName string
	Body       string
	IsInternal bool
}

type ComplaintCaseFilter struct {
	OrderID string
	Limit   int
	Offset  int
}

type ComplaintService struct {
	DB             *gorm.DB
	reminderRunner *ComplaintReminderRunner
}

func NewComplaintService(db *gorm.DB) *ComplaintService {
	return &ComplaintService{DB: db}
}

func (s *ComplaintService) SetReminderRunner(runner *ComplaintReminderRunner) {
	s.reminderRunner = runner
}

func (s *ComplaintService) StartReminderLoop() error {
	if s == nil || s.reminderRunner == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return s.reminderRunner.Start(ctx)
}

func (s *ComplaintService) queueReminderAfterCommit(complaintCaseID string) {
	if s == nil || s.reminderRunner == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := s.reminderRunner.QueueCase(ctx, complaintCaseID); err != nil {
		log.Printf("[WARN] review complaint reminder enqueue failed: %v", err)
	}
}

func (s *ComplaintService) MarkComplaintCaseRead(ctx context.Context, complaintCaseID, participantType, participantID string) error {
	trimmedCaseID := strings.TrimSpace(complaintCaseID)
	trimmedParticipantType := normalizeComplaintSenderType(participantType)
	trimmedParticipantID := strings.TrimSpace(participantID)
	if trimmedCaseID == "" {
		return errors.New("complaint case id is required")
	}
	if trimmedParticipantType == "" {
		return errors.New("participant type is required")
	}
	if trimmedParticipantID == "" {
		return errors.New("participant id is required")
	}

	participantName := trimmedParticipantID
	switch trimmedParticipantType {
	case reviewmodels.ComplaintSenderTypeCustomer:
		if customer, err := s.loadCustomer(ctx, s.DB, trimmedParticipantID); err == nil {
			participantName = complaintDisplayName(customer)
		}
	case reviewmodels.ComplaintSenderTypeMember:
		if name, err := s.loadMemberDisplayName(ctx, trimmedParticipantID); err == nil {
			participantName = name
		}
	case reviewmodels.ComplaintSenderTypeAdmin:
		if name, err := s.loadAdminDisplayName(ctx, trimmedParticipantID); err == nil {
			participantName = name
		}
	}

	now := time.Now().UTC()
	participant := &reviewmodels.ComplaintParticipant{
		ID:              internaluuid.NewString(),
		ComplaintCaseID: trimmedCaseID,
		ParticipantType: trimmedParticipantType,
		ParticipantID:   trimmedParticipantID,
		ParticipantName: participantName,
		LastReadAt:      &now,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	return s.DB.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "complaint_case_id"}, {Name: "participant_type"}, {Name: "participant_id"}}, DoUpdates: clause.AssignmentColumns([]string{"participant_name", "last_read_at", "updated_at"})}).Create(participant).Error
}

func (s *ComplaintService) loadOwnedOrder(ctx context.Context, tx *gorm.DB, customerID, orderID string) (*ordermodels.Order, error) {
	var order ordermodels.Order
	err := tx.WithContext(ctx).
		Where("id = ? AND customer_id = ?", strings.TrimSpace(orderID), strings.TrimSpace(customerID)).
		First(&order).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrComplaintOrderNotFound
		}
		return nil, err
	}
	return &order, nil
}

func (s *ComplaintService) loadCustomer(ctx context.Context, tx *gorm.DB, customerID string) (*authmodels.Customer, error) {
	var customer authmodels.Customer
	err := tx.WithContext(ctx).Where("id = ?", strings.TrimSpace(customerID)).First(&customer).Error
	if err != nil {
		return nil, err
	}
	return &customer, nil
}

func normalizeComplaintText(value string) string {
	return strings.TrimSpace(value)
}

func normalizeComplaintSenderType(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func complaintDisplayName(customer *authmodels.Customer) string {
	if customer == nil {
		return "Customer"
	}
	name := strings.TrimSpace(customer.Name)
	if name != "" {
		return name
	}
	mail := strings.TrimSpace(customer.Email)
	if mail != "" {
		return mail
	}
	return customer.ID
}

func complaintUserDisplayName(fullName, email, fallbackID string) string {
	name := strings.TrimSpace(fullName)
	if name != "" {
		return name
	}
	mail := strings.TrimSpace(email)
	if mail != "" {
		return mail
	}
	return strings.TrimSpace(fallbackID)
}

func (s *ComplaintService) loadMemberBusinessIDs(ctx context.Context, memberID string) ([]string, error) {
	trimmedMemberID := strings.TrimSpace(memberID)
	if trimmedMemberID == "" {
		return nil, errors.New("member id is required")
	}

	var businessIDs []string
	if err := s.DB.WithContext(ctx).
		Table("business_members").
		Where("user_id = ? AND status = ? AND deleted_at IS NULL", trimmedMemberID, "active").
		Distinct("business_id").
		Pluck("business_id", &businessIDs).Error; err != nil {
		return nil, err
	}

	filtered := make([]string, 0, len(businessIDs))
	for _, businessID := range businessIDs {
		trimmedBusinessID := strings.TrimSpace(businessID)
		if trimmedBusinessID != "" {
			filtered = append(filtered, trimmedBusinessID)
		}
	}
	return filtered, nil
}

func (s *ComplaintService) listComplaintCasesQuery(query *gorm.DB, limit, offset int) ([]reviewmodels.ComplaintCase, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var cases []reviewmodels.ComplaintCase
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&cases).Error; err != nil {
		return nil, 0, err
	}
	return cases, total, nil
}

func (s *ComplaintService) loadOrderByID(ctx context.Context, orderID string) (*ordermodels.Order, error) {
	trimmedOrderID := strings.TrimSpace(orderID)
	if trimmedOrderID == "" {
		return nil, ErrComplaintOrderNotFound
	}

	var order ordermodels.Order
	if err := s.DB.WithContext(ctx).Where("id = ?", trimmedOrderID).First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrComplaintOrderNotFound
		}
		return nil, err
	}
	return &order, nil
}

func (s *ComplaintService) loadComplaintCaseByID(ctx context.Context, complaintCaseID string) (*reviewmodels.ComplaintCase, error) {
	trimmedCaseID := strings.TrimSpace(complaintCaseID)
	if trimmedCaseID == "" {
		return nil, ErrComplaintCaseNotFound
	}

	var complaintCase reviewmodels.ComplaintCase
	if err := s.DB.WithContext(ctx).Where("id = ?", trimmedCaseID).First(&complaintCase).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrComplaintCaseNotFound
		}
		return nil, err
	}
	return &complaintCase, nil
}

func (s *ComplaintService) loadComplaintCaseAndOrder(ctx context.Context, complaintCaseID string) (*reviewmodels.ComplaintCase, *ordermodels.Order, error) {
	complaintCase, err := s.loadComplaintCaseByID(ctx, complaintCaseID)
	if err != nil {
		return nil, nil, err
	}

	order, err := s.loadOrderByID(ctx, complaintCase.OrderID)
	if err != nil {
		return nil, nil, err
	}
	return complaintCase, order, nil
}

func (s *ComplaintService) loadMemberOwnedOrder(ctx context.Context, memberID, orderID string) (*ordermodels.Order, error) {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.BusinessID == nil || strings.TrimSpace(*order.BusinessID) == "" {
		return nil, ErrComplaintNotOwned
	}
	allowed, err := s.memberHasBusinessAccess(ctx, memberID, *order.BusinessID)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrComplaintNotOwned
	}
	return order, nil
}

func (s *ComplaintService) memberHasBusinessAccess(ctx context.Context, memberID, businessID string) (bool, error) {
	trimmedMemberID := strings.TrimSpace(memberID)
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedMemberID == "" || trimmedBusinessID == "" {
		return false, nil
	}

	var count int64
	if err := s.DB.WithContext(ctx).
		Table("business_members bm").
		Where("bm.user_id = ? AND bm.business_id = ? AND bm.status = ? AND bm.deleted_at IS NULL", trimmedMemberID, trimmedBusinessID, "active").
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *ComplaintService) loadMemberDisplayName(ctx context.Context, memberID string) (string, error) {
	trimmedMemberID := strings.TrimSpace(memberID)
	if trimmedMemberID == "" {
		return "", errors.New("member id is required")
	}

	var user authmodels.User
	if err := s.DB.WithContext(ctx).Where("id = ?", trimmedMemberID).First(&user).Error; err != nil {
		return "", err
	}
	return complaintUserDisplayName(user.FullName, user.Email, user.ID), nil
}

func (s *ComplaintService) loadAdminDisplayName(ctx context.Context, adminID string) (string, error) {
	trimmedAdminID := strings.TrimSpace(adminID)
	if trimmedAdminID == "" {
		return "", errors.New("admin id is required")
	}

	var admin authmodels.Admin
	if err := s.DB.WithContext(ctx).Where("id = ?", trimmedAdminID).First(&admin).Error; err != nil {
		return "", err
	}
	return complaintUserDisplayName(admin.Username, admin.Email, admin.ID), nil
}

func (s *ComplaintService) loadComplaintCaseDetailByID(ctx context.Context, complaintCaseID string) (*ComplaintCaseDetail, error) {
	complaintCase, err := s.loadComplaintCaseByID(ctx, complaintCaseID)
	if err != nil {
		return nil, err
	}

	var messages []reviewmodels.ComplaintMessage
	if err := s.DB.WithContext(ctx).Where("complaint_case_id = ?", complaintCase.ID).Order("created_at ASC").Find(&messages).Error; err != nil {
		return nil, err
	}

	var participants []reviewmodels.ComplaintParticipant
	if err := s.DB.WithContext(ctx).Where("complaint_case_id = ?", complaintCase.ID).Order("created_at ASC").Find(&participants).Error; err != nil {
		return nil, err
	}

	return &ComplaintCaseDetail{Case: complaintCase, Messages: messages, Participants: participants}, nil
}

func (s *ComplaintService) listComplaintCasesByCustomer(ctx context.Context, customerID, orderID string, limit, offset int) ([]reviewmodels.ComplaintCase, int64, error) {
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedCustomerID == "" {
		return nil, 0, errors.New("customer id is required")
	}

	query := s.DB.WithContext(ctx).Model(&reviewmodels.ComplaintCase{}).Where("customer_id = ?", trimmedCustomerID)
	if trimmedOrderID := strings.TrimSpace(orderID); trimmedOrderID != "" {
		query = query.Where("order_id = ?", trimmedOrderID)
	}
	return s.listComplaintCasesQuery(query, limit, offset)
}

func (s *ComplaintService) listComplaintCasesByMember(ctx context.Context, memberID, orderID string, limit, offset int) ([]reviewmodels.ComplaintCase, int64, error) {
	trimmedMemberID := strings.TrimSpace(memberID)
	if trimmedMemberID == "" {
		return nil, 0, errors.New("member id is required")
	}

	trimmedOrderID := strings.TrimSpace(orderID)
	if trimmedOrderID != "" {
		order, err := s.loadMemberOwnedOrder(ctx, trimmedMemberID, trimmedOrderID)
		if err != nil {
			return nil, 0, err
		}
		query := s.DB.WithContext(ctx).Model(&reviewmodels.ComplaintCase{}).Where("order_id = ?", order.ID)
		return s.listComplaintCasesQuery(query, limit, offset)
	}

	businessIDs, err := s.loadMemberBusinessIDs(ctx, trimmedMemberID)
	if err != nil {
		return nil, 0, err
	}
	if len(businessIDs) == 0 {
		return []reviewmodels.ComplaintCase{}, 0, nil
	}

	query := s.DB.WithContext(ctx).
		Model(&reviewmodels.ComplaintCase{}).
		Joins("JOIN orders ON orders.id = complaint_cases.order_id").
		Where("orders.business_id IN ?", businessIDs)
	return s.listComplaintCasesQuery(query, limit, offset)
}

func (s *ComplaintService) listComplaintCasesByAdmin(ctx context.Context, orderID string, limit, offset int) ([]reviewmodels.ComplaintCase, int64, error) {
	trimmedOrderID := strings.TrimSpace(orderID)
	query := s.DB.WithContext(ctx).Model(&reviewmodels.ComplaintCase{})
	if trimmedOrderID != "" {
		order, err := s.loadOrderByID(ctx, trimmedOrderID)
		if err != nil {
			return nil, 0, err
		}
		query = query.Where("order_id = ?", order.ID)
	}
	return s.listComplaintCasesQuery(query, limit, offset)
}

func (s *ComplaintService) CreateComplaintCase(ctx context.Context, input CreateComplaintInput) (*ComplaintCaseDetail, error) {
	if strings.TrimSpace(input.CustomerID) == "" {
		return nil, errors.New("customer id is required")
	}
	if strings.TrimSpace(input.OrderID) == "" {
		return nil, errors.New("order id is required")
	}
	subject := normalizeComplaintText(input.Subject)
	if subject == "" {
		return nil, ErrComplaintSubjectRequired
	}
	body := normalizeComplaintText(input.Body)
	if body == "" {
		return nil, ErrComplaintBodyRequired
	}

	var createdCase *reviewmodels.ComplaintCase
	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		order, err := s.loadOwnedOrder(ctx, tx, input.CustomerID, input.OrderID)
		if err != nil {
			return err
		}
		customer, err := s.loadCustomer(ctx, tx, input.CustomerID)
		if err != nil {
			return err
		}

		now := time.Now()
		caseID := internaluuid.NewString()
		messageID := internaluuid.NewString()
		participantID := internaluuid.NewString()

		complaintCase := &reviewmodels.ComplaintCase{
			ID:            caseID,
			OrderID:       order.ID,
			CustomerID:    customer.ID,
			Subject:       subject,
			Description:   body,
			Status:        reviewmodels.ComplaintStatusOpen,
			LastMessageAt: &now,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := tx.Create(complaintCase).Error; err != nil {
			return fmt.Errorf("failed to create complaint case: %w", err)
		}

		message := &reviewmodels.ComplaintMessage{
			ID:              messageID,
			ComplaintCaseID: complaintCase.ID,
			SenderType:      reviewmodels.ComplaintSenderTypeCustomer,
			SenderID:        customer.ID,
			SenderName:      complaintDisplayName(customer),
			Body:            body,
			IsInternal:      false,
			CreatedAt:       now,
		}
		if err := tx.Create(message).Error; err != nil {
			return fmt.Errorf("failed to create complaint message: %w", err)
		}

		participant := &reviewmodels.ComplaintParticipant{
			ID:              participantID,
			ComplaintCaseID: complaintCase.ID,
			ParticipantType: reviewmodels.ComplaintSenderTypeCustomer,
			ParticipantID:   customer.ID,
			ParticipantName: complaintDisplayName(customer),
			LastReadAt:      &now,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "complaint_case_id"}, {Name: "participant_type"}, {Name: "participant_id"}}, DoNothing: true}).Create(participant).Error; err != nil {
			return fmt.Errorf("failed to create complaint participant: %w", err)
		}

		createdCase = complaintCase
		return nil
	})
	if err != nil {
		return nil, err
	}
	if createdCase == nil {
		return nil, errors.New("failed to create complaint case")
	}
	s.queueReminderAfterCommit(createdCase.ID)
	return s.GetComplaintCaseDetail(ctx, input.CustomerID, createdCase.ID)
}

func (s *ComplaintService) ListComplaintCasesByOrder(ctx context.Context, customerID, orderID string, limit, offset int) ([]reviewmodels.ComplaintCase, int64, error) {
	return s.listComplaintCasesByCustomer(ctx, customerID, orderID, limit, offset)
}

func (s *ComplaintService) ListComplaintCasesByOrderForMember(ctx context.Context, memberID, orderID string, limit, offset int) ([]reviewmodels.ComplaintCase, int64, error) {
	return s.listComplaintCasesByMember(ctx, memberID, orderID, limit, offset)
}

func (s *ComplaintService) ListComplaintCasesByOrderForAdmin(ctx context.Context, orderID string, limit, offset int) ([]reviewmodels.ComplaintCase, int64, error) {
	return s.listComplaintCasesByAdmin(ctx, orderID, limit, offset)
}

func (s *ComplaintService) GetComplaintCaseDetail(ctx context.Context, customerID, complaintCaseID string) (*ComplaintCaseDetail, error) {
	trimmedCustomerID := strings.TrimSpace(customerID)
	trimmedCaseID := strings.TrimSpace(complaintCaseID)
	if trimmedCustomerID == "" {
		return nil, errors.New("customer id is required")
	}
	if trimmedCaseID == "" {
		return nil, errors.New("complaint case id is required")
	}

	var complaintCase reviewmodels.ComplaintCase
	if err := s.DB.WithContext(ctx).Where("id = ? AND customer_id = ?", trimmedCaseID, trimmedCustomerID).First(&complaintCase).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrComplaintCaseNotFound
		}
		return nil, err
	}
	if err := s.MarkComplaintCaseRead(ctx, complaintCase.ID, reviewmodels.ComplaintSenderTypeCustomer, trimmedCustomerID); err != nil {
		log.Printf("[WARN] review complaint mark-read failed: %v", err)
	}
	return s.loadComplaintCaseDetailByID(ctx, complaintCase.ID)
}

func (s *ComplaintService) GetComplaintCaseDetailForMember(ctx context.Context, memberID, complaintCaseID string) (*ComplaintCaseDetail, error) {
	complaintCase, order, err := s.loadComplaintCaseAndOrder(ctx, complaintCaseID)
	if err != nil {
		return nil, err
	}
	if order.BusinessID == nil {
		return nil, ErrComplaintNotOwned
	}
	allowed, err := s.memberHasBusinessAccess(ctx, memberID, *order.BusinessID)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrComplaintNotOwned
	}
	if err := s.MarkComplaintCaseRead(ctx, complaintCase.ID, reviewmodels.ComplaintSenderTypeMember, memberID); err != nil {
		log.Printf("[WARN] review complaint mark-read failed: %v", err)
	}
	return s.loadComplaintCaseDetailByID(ctx, complaintCase.ID)
}

func (s *ComplaintService) GetComplaintCaseDetailForAdmin(ctx context.Context, adminID, complaintCaseID string) (*ComplaintCaseDetail, error) {
	complaintCase, err := s.loadComplaintCaseByID(ctx, complaintCaseID)
	if err != nil {
		return nil, err
	}
	if err := s.MarkComplaintCaseRead(ctx, complaintCase.ID, reviewmodels.ComplaintSenderTypeAdmin, adminID); err != nil {
		log.Printf("[WARN] review complaint mark-read failed: %v", err)
	}
	return s.loadComplaintCaseDetailByID(ctx, complaintCase.ID)
}

func (s *ComplaintService) AddComplaintMessage(ctx context.Context, complaintCaseID string, input ComplaintMessageInput) (*reviewmodels.ComplaintMessage, error) {
	trimmedCaseID := strings.TrimSpace(complaintCaseID)
	trimmedBody := normalizeComplaintText(input.Body)
	if trimmedCaseID == "" {
		return nil, errors.New("complaint case id is required")
	}
	if trimmedBody == "" {
		return nil, ErrComplaintBodyRequired
	}
	senderType := normalizeComplaintSenderType(input.SenderType)
	if senderType == "" {
		return nil, errors.New("sender type is required")
	}
	if strings.TrimSpace(input.SenderID) == "" {
		return nil, errors.New("sender id is required")
	}
	senderName := strings.TrimSpace(input.SenderName)

	now := time.Now()
	var createdMessage *reviewmodels.ComplaintMessage
	err := db.WithTransaction(ctx, s.DB, func(tx *gorm.DB) error {
		var complaintCase reviewmodels.ComplaintCase
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", trimmedCaseID).First(&complaintCase).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrComplaintCaseNotFound
			}
			return err
		}
		if complaintCase.Status == reviewmodels.ComplaintStatusClosed {
			return ErrComplaintCaseClosed
		}
		if senderName == "" {
			switch senderType {
			case reviewmodels.ComplaintSenderTypeCustomer:
				if customer, err := s.loadCustomer(ctx, tx, input.SenderID); err == nil {
					senderName = complaintDisplayName(customer)
				}
			case reviewmodels.ComplaintSenderTypeMember:
				if name, err := s.loadMemberDisplayName(ctx, input.SenderID); err == nil {
					senderName = name
				}
			case reviewmodels.ComplaintSenderTypeAdmin:
				if name, err := s.loadAdminDisplayName(ctx, input.SenderID); err == nil {
					senderName = name
				}
			}
		}
		if senderName == "" {
			senderName = strings.TrimSpace(input.SenderID)
		}

		messageID := internaluuid.NewString()
		message := &reviewmodels.ComplaintMessage{
			ID:              messageID,
			ComplaintCaseID: complaintCase.ID,
			SenderType:      senderType,
			SenderID:        strings.TrimSpace(input.SenderID),
			SenderName:      senderName,
			Body:            trimmedBody,
			IsInternal:      input.IsInternal,
			CreatedAt:       now,
		}
		if err := tx.Create(message).Error; err != nil {
			return fmt.Errorf("failed to create complaint message: %w", err)
		}

		participant := &reviewmodels.ComplaintParticipant{
			ID:              internaluuid.NewString(),
			ComplaintCaseID: complaintCase.ID,
			ParticipantType: senderType,
			ParticipantID:   strings.TrimSpace(input.SenderID),
			ParticipantName: senderName,
			LastReadAt:      &now,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "complaint_case_id"}, {Name: "participant_type"}, {Name: "participant_id"}}, DoUpdates: clause.AssignmentColumns([]string{"participant_name", "updated_at"})}).Create(participant).Error; err != nil {
			return fmt.Errorf("failed to upsert complaint participant: %w", err)
		}

		if err := tx.Model(&reviewmodels.ComplaintCase{}).
			Where("id = ?", complaintCase.ID).
			Updates(map[string]any{"last_message_at": now, "updated_at": now}).Error; err != nil {
			return fmt.Errorf("failed to update complaint case timeline: %w", err)
		}

		createdMessage = message
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.queueReminderAfterCommit(trimmedCaseID)
	return createdMessage, nil
}

func (s *ComplaintService) RequestComplaintClose(ctx context.Context, complaintCaseID string, input ComplaintMessageInput) (*reviewmodels.ComplaintMessage, error) {
	requesterBody := strings.TrimSpace(input.Body)
	if requesterBody == "" {
		requesterBody = "Member requested complaint closure."
	}
	input.Body = requesterBody
	input.IsInternal = true
	return s.AddComplaintMessage(ctx, complaintCaseID, input)
}

func (s *ComplaintService) ResolveComplaintCase(ctx context.Context, complaintCaseID string) error {
	return s.setComplaintCaseStatus(ctx, complaintCaseID, reviewmodels.ComplaintStatusResolved)
}

func (s *ComplaintService) CloseComplaintCase(ctx context.Context, complaintCaseID string) error {
	return s.setComplaintCaseStatus(ctx, complaintCaseID, reviewmodels.ComplaintStatusClosed)
}

func (s *ComplaintService) setComplaintCaseStatus(ctx context.Context, complaintCaseID, status string) error {
	trimmedCaseID := strings.TrimSpace(complaintCaseID)
	trimmedStatus := strings.ToLower(strings.TrimSpace(status))
	if trimmedCaseID == "" {
		return errors.New("complaint case id is required")
	}
	switch trimmedStatus {
	case reviewmodels.ComplaintStatusOpen, reviewmodels.ComplaintStatusResolved, reviewmodels.ComplaintStatusClosed:
	default:
		return fmt.Errorf("invalid complaint status: %s", status)
	}

	now := time.Now()
	updates := map[string]any{"status": trimmedStatus, "updated_at": now}
	switch trimmedStatus {
	case reviewmodels.ComplaintStatusResolved:
		updates["resolved_at"] = &now
	case reviewmodels.ComplaintStatusClosed:
		updates["closed_at"] = &now
	}
	return s.DB.WithContext(ctx).Model(&reviewmodels.ComplaintCase{}).Where("id = ?", trimmedCaseID).Updates(updates).Error
}
