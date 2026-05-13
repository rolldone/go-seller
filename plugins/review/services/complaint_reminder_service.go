package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"go_framework/internal/keydb"
	internaluuid "go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	catalogmodels "go_framework/plugins/catalog/models"
	ordermodels "go_framework/plugins/order/models"
	pluginregistry "go_framework/plugins/plugin_registry"
	reviewmodels "go_framework/plugins/review/models"
)

const (
	complaintReminderQueueKey      = "review:complaint:reminder:queue"
	complaintReminderJobPrefix     = "review:complaint:reminder:job:"
	complaintReminderLockPrefix    = "review:complaint:reminder:lock:"
	complaintReminderJobTTL        = 7 * 24 * time.Hour
	complaintReminderLockTTL       = 5 * time.Minute
	complaintReminderWorkerBatch   = 50
	complaintReminderDueMinutes    = 10
	complaintReminderMaxAttempts   = 3
	complaintReminderRetryBackoff1 = 1 * time.Minute
	complaintReminderRetryBackoff2 = 5 * time.Minute
	complaintReminderRetryBackoff3 = 15 * time.Minute
)

type ComplaintReminderJob struct {
	JobKey                string    `json:"job_key"`
	ComplaintCaseID       string    `json:"complaint_case_id"`
	OrderID               string    `json:"order_id"`
	OrderNumber           string    `json:"order_number"`
	ComplaintSubject      string    `json:"complaint_subject"`
	CustomerID            string    `json:"customer_id"`
	CustomerName          string    `json:"customer_name"`
	CustomerEmail         string    `json:"customer_email"`
	BusinessID            string    `json:"business_id,omitempty"`
	BusinessName          string    `json:"business_name,omitempty"`
	BusinessEmails        string    `json:"business_emails,omitempty"`
	SenderType            string    `json:"sender_type"`
	RecipientType         string    `json:"recipient_type"`
	RecipientRefID        string    `json:"recipient_ref_id"`
	RecipientLabel        string    `json:"recipient_label"`
	RecipientEmails       string    `json:"recipient_emails"`
	ExpectedLastMessageAt time.Time `json:"expected_last_message_at"`
	DueAt                 time.Time `json:"due_at"`
	AttemptCount          int       `json:"attempt_count"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type ComplaintReminderRunner struct {
	svc      *ComplaintService
	cron     *cron.Cron
	once     sync.Once
	startErr error
}

func NewComplaintReminderRunner(svc *ComplaintService) *ComplaintReminderRunner {
	return &ComplaintReminderRunner{svc: svc}
}

func (r *ComplaintReminderRunner) Start(ctx context.Context) error {
	if r == nil || r.svc == nil || r.svc.DB == nil {
		return nil
	}
	if keydb.Client == nil {
		log.Printf("[review] complaint reminder disabled: keydb client is not initialized")
		return nil
	}
	r.once.Do(func() {
		if err := r.bootstrap(ctx); err != nil {
			log.Printf("[review] complaint reminder bootstrap failed: %v", err)
		}
		c := cron.New()
		if _, err := c.AddFunc("@every 1m", func() {
			tickCtx, cancel := context.WithTimeout(context.Background(), 55*time.Second)
			defer cancel()
			if err := r.processDueJobs(tickCtx); err != nil {
				log.Printf("[review] complaint reminder worker error: %v", err)
			}
		}); err != nil {
			r.startErr = err
			return
		}
		r.cron = c
		c.Start()
		log.Printf("[review] complaint reminder worker started")
	})
	return r.startErr
}

func (r *ComplaintReminderRunner) QueueCase(ctx context.Context, complaintCaseID string) error {
	if r == nil || r.svc == nil || r.svc.DB == nil {
		return nil
	}
	if keydb.Client == nil {
		return errors.New("keydb client is not initialized")
	}
	job, err := r.buildJob(ctx, complaintCaseID)
	if err != nil {
		return err
	}
	if job == nil {
		return nil
	}
	return r.enqueueJob(ctx, job)
}

func (r *ComplaintReminderRunner) bootstrap(ctx context.Context) error {
	var cases []reviewmodels.ComplaintCase
	if err := r.svc.DB.WithContext(ctx).
		Where("status = ?", reviewmodels.ComplaintStatusOpen).
		Order("created_at asc").
		Find(&cases).Error; err != nil {
		return err
	}
	for i := range cases {
		caseID := strings.TrimSpace(cases[i].ID)
		if caseID == "" {
			continue
		}
		if err := r.QueueCase(ctx, caseID); err != nil {
			log.Printf("[review] complaint reminder bootstrap queue failed for %s: %v", caseID, err)
		}
	}
	return nil
}

func (r *ComplaintReminderRunner) buildJob(ctx context.Context, complaintCaseID string) (*ComplaintReminderJob, error) {
	complaintCase, order, err := r.svc.loadComplaintCaseAndOrder(ctx, complaintCaseID)
	if err != nil {
		return nil, err
	}
	if complaintCase == nil || order == nil {
		return nil, nil
	}
	if !strings.EqualFold(strings.TrimSpace(complaintCase.Status), reviewmodels.ComplaintStatusOpen) {
		return nil, nil
	}
	if complaintCase.LastMessageAt == nil {
		return nil, nil
	}

	latestMessage, err := r.loadLatestComplaintMessage(ctx, complaintCase.ID)
	if err != nil {
		return nil, err
	}
	if latestMessage == nil {
		return nil, nil
	}

	recipientType := reminderRecipientTypeForSender(latestMessage.SenderType)
	if recipientType == "" {
		return nil, nil
	}

	job, err := r.resolveReminderJob(ctx, complaintCase, order, latestMessage, recipientType)
	if err != nil {
		return nil, err
	}
	return job, nil
}

func (r *ComplaintReminderRunner) resolveReminderJob(ctx context.Context, complaintCase *reviewmodels.ComplaintCase, order *ordermodels.Order, latestMessage *reviewmodels.ComplaintMessage, recipientType string) (*ComplaintReminderJob, error) {
	if complaintCase == nil || order == nil || latestMessage == nil {
		return nil, nil
	}

	lastMessageAt := latestMessage.CreatedAt.UTC()
	dueAt := lastMessageAt.Add(complaintReminderDueMinutes * time.Minute)
	jobKey := fmt.Sprintf("%s%s:%s:%d", complaintReminderJobPrefix, complaintCase.ID, recipientType, lastMessageAt.UnixNano())

	customer, err := r.loadReminderCustomer(ctx, complaintCase.CustomerID)
	if err != nil {
		return nil, err
	}
	if customer == nil {
		return nil, errors.New("customer not found for reminder")
	}
	customerEmail := strings.TrimSpace(customer.Email)
	if customerEmail == "" {
		return nil, errors.New("customer email is required for complaint reminder")
	}
	customerName := complaintDisplayName(customer)

	var businessID string
	var businessName string
	var businessEmails string
	if order.BusinessID != nil {
		businessID = strings.TrimSpace(*order.BusinessID)
		if businessID != "" {
			var business catalogmodels.Business
			if err := r.svc.DB.WithContext(ctx).Where("id = ?", businessID).First(&business).Error; err != nil {
				return nil, err
			}
			businessName = strings.TrimSpace(business.Name)
			businessEmails, err = r.loadBusinessReminderEmails(ctx, businessID, business)
			if err != nil {
				return nil, err
			}
		}
	}

	recipientLabel := customerName
	recipientEmails := customerEmail
	recipientRefID := complaintCase.CustomerID
	if recipientType == reviewmodels.ComplaintReminderRecipientTypeBusiness {
		recipientLabel = firstNonEmpty(businessName, "Business")
		recipientEmails = businessEmails
		recipientRefID = businessID
		if recipientEmails == "" {
			return nil, nil
		}
	}

	if strings.TrimSpace(recipientEmails) == "" {
		return nil, nil
	}

	now := time.Now().UTC()
	job := &ComplaintReminderJob{
		JobKey:                jobKey,
		ComplaintCaseID:       complaintCase.ID,
		OrderID:               complaintCase.OrderID,
		OrderNumber:           strings.TrimSpace(order.OrderNumber),
		ComplaintSubject:      strings.TrimSpace(complaintCase.Subject),
		CustomerID:            complaintCase.CustomerID,
		CustomerName:          customerName,
		CustomerEmail:         customerEmail,
		BusinessID:            businessID,
		BusinessName:          businessName,
		BusinessEmails:        businessEmails,
		SenderType:            normalizeComplaintSenderType(latestMessage.SenderType),
		RecipientType:         recipientType,
		RecipientRefID:        recipientRefID,
		RecipientLabel:        recipientLabel,
		RecipientEmails:       recipientEmails,
		ExpectedLastMessageAt: lastMessageAt,
		DueAt:                 dueAt,
		AttemptCount:          0,
		CreatedAt:             now,
		UpdatedAt:             now,
	}
	return job, nil
}

func (r *ComplaintReminderRunner) loadLatestComplaintMessage(ctx context.Context, complaintCaseID string) (*reviewmodels.ComplaintMessage, error) {
	var message reviewmodels.ComplaintMessage
	if err := r.svc.DB.WithContext(ctx).
		Where("complaint_case_id = ?", strings.TrimSpace(complaintCaseID)).
		Order("created_at desc").
		First(&message).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &message, nil
}

func (r *ComplaintReminderRunner) loadBusinessReminderEmails(ctx context.Context, businessID string, business catalogmodels.Business) (string, error) {
	emails := make([]string, 0, 8)
	seen := map[string]struct{}{}
	addEmail := func(value string) {
		email := strings.TrimSpace(value)
		if email == "" {
			return
		}
		if _, ok := seen[email]; ok {
			return
		}
		seen[email] = struct{}{}
		emails = append(emails, email)
	}

	if business.Email != nil {
		addEmail(*business.Email)
	}

	type businessMemberEmailRow struct {
		Email string `gorm:"column:email"`
	}
	var rows []businessMemberEmailRow
	if err := r.svc.DB.WithContext(ctx).
		Table("business_members bm").
		Select("u.email AS email").
		Joins("JOIN users u ON u.id = bm.user_id").
		Where("bm.business_id = ? AND bm.status = ? AND bm.deleted_at IS NULL AND u.deleted_at IS NULL", businessID, "active").
		Order("bm.is_owner DESC, bm.created_at ASC").
		Scan(&rows).Error; err != nil {
		return "", err
	}
	for _, row := range rows {
		addEmail(row.Email)
	}
	sort.Strings(emails)
	if len(emails) == 0 {
		return "", nil
	}
	return strings.Join(emails, ","), nil
}

func (r *ComplaintReminderRunner) enqueueJob(ctx context.Context, job *ComplaintReminderJob) error {
	if job == nil {
		return nil
	}
	if keydb.Client == nil {
		return errors.New("keydb client is not initialized")
	}

	payload, err := json.Marshal(job)
	if err != nil {
		return err
	}
	set, err := keydb.Client.SetNX(ctx, job.JobKey, string(payload), complaintReminderJobTTL).Result()
	if err != nil {
		return err
	}
	if !set {
		return nil
	}
	if err := keydb.Client.ZAdd(ctx, complaintReminderQueueKey, redis.Z{Score: float64(job.DueAt.UTC().Unix()), Member: job.JobKey}).Err(); err != nil {
		return err
	}
	if err := r.createReminderLog(ctx, job); err != nil {
		log.Printf("[review] complaint reminder log insert failed for %s: %v", job.JobKey, err)
	}
	return nil
}

func (r *ComplaintReminderRunner) processDueJobs(ctx context.Context) error {
	if r == nil || r.svc == nil || r.svc.DB == nil || keydb.Client == nil {
		return nil
	}
	now := time.Now().UTC()
	jobKeys, err := keydb.Client.ZRangeByScore(ctx, complaintReminderQueueKey, &redis.ZRangeBy{Min: "-inf", Max: fmt.Sprintf("%d", now.Unix()), Offset: 0, Count: complaintReminderWorkerBatch}).Result()
	if err != nil {
		return err
	}
	for _, jobKey := range jobKeys {
		jobKey = strings.TrimSpace(jobKey)
		if jobKey == "" {
			continue
		}
		if err := r.processJob(ctx, jobKey, now); err != nil {
			log.Printf("[review] complaint reminder job %s failed: %v", jobKey, err)
		}
	}
	return nil
}

func (r *ComplaintReminderRunner) processJob(ctx context.Context, jobKey string, now time.Time) error {
	lockKey := complaintReminderLockPrefix + jobKey
	locked, err := keydb.Client.SetNX(ctx, lockKey, now.Format(time.RFC3339Nano), complaintReminderLockTTL).Result()
	if err != nil || !locked {
		return err
	}
	defer func() {
		_ = keydb.Client.Del(context.Background(), lockKey).Err()
	}()

	payloadRaw, err := keydb.Client.Get(ctx, jobKey).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			_ = keydb.Client.ZRem(ctx, complaintReminderQueueKey, jobKey).Err()
			return nil
		}
		return err
	}

	var job ComplaintReminderJob
	if err := json.Unmarshal(payloadRaw, &job); err != nil {
		_ = r.finalizeJob(ctx, jobKey, reviewmodels.ComplaintReminderStatusFailed, "invalid reminder payload", nil, true)
		return err
	}
	if err := r.ensureReminderLog(ctx, &job); err != nil {
		log.Printf("[review] complaint reminder log ensure failed for %s: %v", jobKey, err)
	}

	currentScore, err := keydb.Client.ZScore(ctx, complaintReminderQueueKey, jobKey).Result()
	if err == nil {
		currentDue := time.Unix(int64(currentScore), 0).UTC()
		if currentDue.After(now) {
			return nil
		}
	}

	complaintCase, order, err := r.svc.loadComplaintCaseAndOrder(ctx, job.ComplaintCaseID)
	if err != nil {
		if errors.Is(err, ErrComplaintCaseNotFound) || errors.Is(err, ErrComplaintOrderNotFound) {
			return r.finalizeJob(ctx, jobKey, reviewmodels.ComplaintReminderStatusSkipped, "complaint case no longer exists", nil, true)
		}
		return err
	}
	if complaintCase == nil || order == nil {
		return r.finalizeJob(ctx, jobKey, reviewmodels.ComplaintReminderStatusSkipped, "complaint case no longer exists", nil, true)
	}
	if !strings.EqualFold(strings.TrimSpace(complaintCase.Status), reviewmodels.ComplaintStatusOpen) {
		return r.finalizeJob(ctx, jobKey, reviewmodels.ComplaintReminderStatusSkipped, "complaint is already closed", nil, true)
	}
	if complaintCase.LastMessageAt == nil || !complaintCase.LastMessageAt.UTC().Equal(job.ExpectedLastMessageAt.UTC()) {
		return r.finalizeJob(ctx, jobKey, reviewmodels.ComplaintReminderStatusSkipped, "reminder became stale after a newer message arrived", nil, true)
	}

	read, err := r.isRecipientAlreadyRead(ctx, complaintCase, order, &job)
	if err != nil {
		return err
	}
	if read {
		return r.finalizeJob(ctx, jobKey, reviewmodels.ComplaintReminderStatusSkipped, "recipient already read the latest message", nil, true)
	}

	job.AttemptCount++
	if err := r.markReminderProcessing(ctx, &job); err != nil {
		return err
	}

	if err := r.sendReminder(ctx, complaintCase, order, &job); err != nil {
		return r.handleSendFailure(ctx, &job, err)
	}
	return r.finalizeJob(ctx, jobKey, reviewmodels.ComplaintReminderStatusSent, "", nil, true)
}

func (r *ComplaintReminderRunner) isRecipientAlreadyRead(ctx context.Context, complaintCase *reviewmodels.ComplaintCase, order *ordermodels.Order, job *ComplaintReminderJob) (bool, error) {
	if complaintCase == nil || job == nil || complaintCase.LastMessageAt == nil {
		return false, nil
	}
	lastMessageAt := complaintCase.LastMessageAt.UTC()
	switch job.RecipientType {
	case reviewmodels.ComplaintReminderRecipientTypeCustomer:
		var participant reviewmodels.ComplaintParticipant
		err := r.svc.DB.WithContext(ctx).
			Where("complaint_case_id = ? AND participant_type = ? AND participant_id = ?", complaintCase.ID, reviewmodels.ComplaintSenderTypeCustomer, job.CustomerID).
			First(&participant).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		if participant.LastReadAt == nil {
			return false, nil
		}
		return !participant.LastReadAt.UTC().Before(lastMessageAt), nil
	case reviewmodels.ComplaintReminderRecipientTypeBusiness:
		if order == nil || order.BusinessID == nil || strings.TrimSpace(*order.BusinessID) == "" {
			return false, nil
		}
		businessID := strings.TrimSpace(*order.BusinessID)
		var count int64
		if err := r.svc.DB.WithContext(ctx).
			Table("complaint_participants cp").
			Joins("JOIN business_members bm ON bm.user_id = cp.participant_id AND bm.business_id = ? AND bm.status = ? AND bm.deleted_at IS NULL", businessID, "active").
			Where("cp.complaint_case_id = ? AND cp.participant_type = ? AND cp.last_read_at IS NOT NULL AND cp.last_read_at >= ?", complaintCase.ID, reviewmodels.ComplaintSenderTypeMember, lastMessageAt).
			Count(&count).Error; err != nil {
			return false, err
		}
		return count > 0, nil
	default:
		return false, nil
	}
}

func (r *ComplaintReminderRunner) sendReminder(ctx context.Context, complaintCase *reviewmodels.ComplaintCase, order *ordermodels.Order, job *ComplaintReminderJob) error {
	if complaintCase == nil || order == nil || job == nil {
		return errors.New("complaint reminder job is incomplete")
	}

	payload, eventKey, err := r.buildNotificationPayload(ctx, complaintCase, order, job)
	if err != nil {
		return err
	}
	if err := pluginregistry.SendTemplateEvent(ctx, r.svc.DB, eventKey, payload); err != nil {
		return err
	}
	return nil
}

func (r *ComplaintReminderRunner) buildNotificationPayload(ctx context.Context, complaintCase *reviewmodels.ComplaintCase, order *ordermodels.Order, job *ComplaintReminderJob) (map[string]interface{}, string, error) {
	if complaintCase == nil || order == nil || job == nil {
		return nil, "", errors.New("complaint reminder payload is incomplete")
	}
	customer, err := r.loadReminderCustomer(ctx, complaintCase.CustomerID)
	if err != nil {
		return nil, "", err
	}
	if customer == nil {
		return nil, "", errors.New("customer not found for reminder")
	}

	complaintLink := "/customer/complaints"
	switch job.RecipientType {
	case reviewmodels.ComplaintReminderRecipientTypeBusiness:
		complaintLink = "/member/complaints"
	case reviewmodels.ComplaintReminderRecipientTypeCustomer:
		complaintLink = "/customer/complaints"
	}
	if strings.TrimSpace(job.OrderID) != "" {
		complaintLink += "?order_id=" + job.OrderID
	}

	payload := map[string]interface{}{
		"app_name":                 "Go Seller",
		"complaint_case_id":        complaintCase.ID,
		"complaint_subject":        strings.TrimSpace(complaintCase.Subject),
		"order_id":                 complaintCase.OrderID,
		"order_number":             strings.TrimSpace(order.OrderNumber),
		"customer_id":              complaintCase.CustomerID,
		"customer_name":            complaintDisplayName(customer),
		"customer_email":           strings.TrimSpace(customer.Email),
		"customer_locale":          strings.TrimSpace(customer.Locale),
		"recipient_name":           firstNonEmpty(job.RecipientLabel, complaintDisplayName(customer)),
		"recipient_emails":         job.RecipientEmails,
		"recipient_type":           job.RecipientType,
		"sender_type":              job.SenderType,
		"due_at":                   job.DueAt.UTC().Format(time.RFC3339),
		"expected_last_message_at": job.ExpectedLastMessageAt.UTC().Format(time.RFC3339),
		"complaint_link":           complaintLink,
	}
	if order.BusinessID != nil {
		payload["business_id"] = strings.TrimSpace(*order.BusinessID)
	}
	if job.BusinessID != "" {
		payload["business_name"] = job.BusinessName
		payload["business_email"] = job.BusinessEmails
	}
	if job.RecipientType == reviewmodels.ComplaintReminderRecipientTypeBusiness {
		payload["recipient_name"] = firstNonEmpty(job.RecipientLabel, job.BusinessName, "Business")
		payload["recipient_emails"] = job.RecipientEmails
	} else {
		payload["recipient_name"] = firstNonEmpty(job.RecipientLabel, complaintDisplayName(customer), "Customer")
		payload["recipient_emails"] = job.RecipientEmails
	}

	eventKey := complaintReminderEventKey(job.RecipientType)
	if eventKey == "" {
		return nil, "", errors.New("invalid complaint reminder recipient type")
	}
	return payload, eventKey, nil
}

func (r *ComplaintReminderRunner) loadReminderCustomer(ctx context.Context, customerID string) (*authmodels.Customer, error) {
	trimmedCustomerID := strings.TrimSpace(customerID)
	if trimmedCustomerID == "" {
		return nil, errors.New("customer id is required")
	}
	var customer authmodels.Customer
	if err := r.svc.DB.WithContext(ctx).Where("id = ?", trimmedCustomerID).First(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

func (r *ComplaintReminderRunner) handleSendFailure(ctx context.Context, job *ComplaintReminderJob, sendErr error) error {
	if job == nil {
		return sendErr
	}
	backoff := complaintReminderRetryBackoff(job.AttemptCount)
	if job.AttemptCount >= complaintReminderMaxAttempts || backoff <= 0 {
		message := sendErr.Error()
		return r.finalizeJob(ctx, job.JobKey, reviewmodels.ComplaintReminderStatusFailed, "notification send failed", &message, true)
	}
	nextRunAt := time.Now().UTC().Add(backoff)
	job.DueAt = nextRunAt
	job.UpdatedAt = time.Now().UTC()
	payload, err := json.Marshal(job)
	if err != nil {
		return err
	}
	if err := keydb.Client.Set(ctx, job.JobKey, string(payload), complaintReminderJobTTL).Err(); err != nil {
		return err
	}
	if err := keydb.Client.ZAdd(ctx, complaintReminderQueueKey, redis.Z{Score: float64(nextRunAt.Unix()), Member: job.JobKey}).Err(); err != nil {
		return err
	}
	message := sendErr.Error()
	return r.upsertReminderLogByKey(ctx, job.JobKey, reviewmodels.ComplaintReminderStatusRetrying, "", &message, nil, &nextRunAt)
}

func (r *ComplaintReminderRunner) finalizeJob(ctx context.Context, jobKey, status, skipReason string, errorMessage *string, removeFromQueue bool) error {
	if jobKey == "" {
		return nil
	}
	if removeFromQueue {
		_ = keydb.Client.ZRem(ctx, complaintReminderQueueKey, jobKey).Err()
		_ = keydb.Client.Del(ctx, jobKey).Err()
	}
	var skippedAt *time.Time
	if status == reviewmodels.ComplaintReminderStatusSkipped {
		now := time.Now().UTC()
		skippedAt = &now
	}
	return r.upsertReminderLogByKey(ctx, jobKey, status, skipReason, errorMessage, skippedAt, nil)
}

func (r *ComplaintReminderRunner) createReminderLog(ctx context.Context, job *ComplaintReminderJob) error {
	if r == nil || r.svc == nil || r.svc.DB == nil || job == nil {
		return nil
	}
	row := reviewmodels.ComplaintReminderLog{
		ID:                    internaluuid.NewString(),
		ReminderKey:           job.JobKey,
		ComplaintCaseID:       job.ComplaintCaseID,
		OrderID:               job.OrderID,
		OrderNumber:           job.OrderNumber,
		ComplaintSubject:      job.ComplaintSubject,
		SenderType:            job.SenderType,
		RecipientType:         job.RecipientType,
		RecipientRefID:        job.RecipientRefID,
		RecipientLabel:        job.RecipientLabel,
		RecipientEmails:       job.RecipientEmails,
		ExpectedLastMessageAt: job.ExpectedLastMessageAt.UTC(),
		DueAt:                 job.DueAt.UTC(),
		Status:                reviewmodels.ComplaintReminderStatusQueued,
		AttemptCount:          job.AttemptCount,
		CreatedAt:             time.Now().UTC(),
		UpdatedAt:             time.Now().UTC(),
	}
	return r.svc.DB.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "reminder_key"}}, DoNothing: true}).Create(&row).Error
}

func (r *ComplaintReminderRunner) ensureReminderLog(ctx context.Context, job *ComplaintReminderJob) error {
	if r == nil || r.svc == nil || r.svc.DB == nil || job == nil {
		return nil
	}
	var existing reviewmodels.ComplaintReminderLog
	err := r.svc.DB.WithContext(ctx).Where("reminder_key = ?", job.JobKey).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return r.createReminderLog(ctx, job)
}

func (r *ComplaintReminderRunner) markReminderProcessing(ctx context.Context, job *ComplaintReminderJob) error {
	if r == nil || r.svc == nil || r.svc.DB == nil || job == nil {
		return nil
	}
	updates := map[string]any{
		"status":        reviewmodels.ComplaintReminderStatusProcessing,
		"attempt_count": job.AttemptCount,
		"updated_at":    time.Now().UTC(),
		"next_run_at":   nil,
	}
	return r.svc.DB.WithContext(ctx).Model(&reviewmodels.ComplaintReminderLog{}).Where("reminder_key = ?", job.JobKey).Updates(updates).Error
}

func (r *ComplaintReminderRunner) upsertReminderLogByKey(ctx context.Context, jobKey, status, skipReason string, errorMessage *string, skippedAt *time.Time, nextRunAt *time.Time) error {
	if r == nil || r.svc == nil || r.svc.DB == nil {
		return nil
	}
	updates := map[string]any{
		"status":     status,
		"updated_at": time.Now().UTC(),
	}
	if skipReason != "" {
		updates["skip_reason"] = skipReason
	}
	if errorMessage != nil {
		updates["last_error"] = *errorMessage
	}
	if skippedAt != nil {
		updates["skipped_at"] = *skippedAt
	}
	if nextRunAt != nil {
		updates["next_run_at"] = *nextRunAt
	}
	return r.svc.DB.WithContext(ctx).Model(&reviewmodels.ComplaintReminderLog{}).Where("reminder_key = ?", jobKey).Updates(updates).Error
}

func reminderRecipientTypeForSender(senderType string) string {
	switch normalizeComplaintSenderType(senderType) {
	case reviewmodels.ComplaintSenderTypeCustomer:
		return reviewmodels.ComplaintReminderRecipientTypeBusiness
	case reviewmodels.ComplaintSenderTypeMember, reviewmodels.ComplaintSenderTypeAdmin:
		return reviewmodels.ComplaintReminderRecipientTypeCustomer
	default:
		return ""
	}
}

func complaintReminderEventKey(recipientType string) string {
	switch normalizeComplaintSenderType(recipientType) {
	case reviewmodels.ComplaintReminderRecipientTypeCustomer:
		return "complaint_reminder_customer"
	case reviewmodels.ComplaintReminderRecipientTypeBusiness:
		return "complaint_reminder_business"
	default:
		return ""
	}
}

func complaintReminderRetryBackoff(attempt int) time.Duration {
	switch attempt {
	case 1:
		return complaintReminderRetryBackoff1
	case 2:
		return complaintReminderRetryBackoff2
	case 3:
		return complaintReminderRetryBackoff3
	default:
		return 0
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
