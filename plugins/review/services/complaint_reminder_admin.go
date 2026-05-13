package services

import (
	"context"
	"errors"
	"strings"

	reviewmodels "go_framework/plugins/review/models"
)

type ComplaintReminderLogFilter struct {
	Status          string
	RecipientType   string
	SenderType      string
	OrderID         string
	ComplaintCaseID string
	Query           string
	Page            int
	Limit           int
}

func (s *ComplaintService) ListComplaintReminderLogs(ctx context.Context, filter ComplaintReminderLogFilter) ([]reviewmodels.ComplaintReminderLog, int64, error) {
	if s == nil || s.DB == nil {
		return nil, 0, errors.New("complaint service not configured")
	}

	page := filter.Page
	if page <= 0 {
		page = 1
	}
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	query := s.DB.WithContext(ctx).Model(&reviewmodels.ComplaintReminderLog{})
	if status := strings.ToLower(normalizeComplaintText(filter.Status)); status != "" {
		query = query.Where("status = ?", status)
	}
	if recipientType := strings.ToLower(normalizeComplaintText(filter.RecipientType)); recipientType != "" {
		query = query.Where("recipient_type = ?", recipientType)
	}
	if senderType := strings.ToLower(normalizeComplaintText(filter.SenderType)); senderType != "" {
		query = query.Where("sender_type = ?", senderType)
	}
	if orderID := normalizeComplaintText(filter.OrderID); orderID != "" {
		query = query.Where("order_id = ?", orderID)
	}
	if complaintCaseID := normalizeComplaintText(filter.ComplaintCaseID); complaintCaseID != "" {
		query = query.Where("complaint_case_id = ?", complaintCaseID)
	}
	if search := normalizeComplaintText(filter.Query); search != "" {
		like := "%" + search + "%"
		query = query.Where(
			"(order_number ILIKE ? OR complaint_subject ILIKE ? OR recipient_label ILIKE ? OR recipient_emails ILIKE ? OR COALESCE(last_error, '') ILIKE ? OR COALESCE(skip_reason, '') ILIKE ? OR reminder_key ILIKE ?)",
			like, like, like, like, like, like, like,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []reviewmodels.ComplaintReminderLog
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}
