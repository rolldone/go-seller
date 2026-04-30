package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	financemodels "go_framework/plugins/finance/models"
)

// CreatePayoutRequest inserts a new payout request and schedules processing (simulation).
func (s *FinanceService) CreatePayoutRequest(ctx context.Context, p *financemodels.Payout) error {
	// basic validation: bank account existence is checked by caller/handler
	if err := s.DB.WithContext(ctx).Create(p).Error; err != nil {
		return err
	}
	// simulate async processing (non-blocking)
	go func(id string) {
		// small delay to simulate work
		time.Sleep(2 * time.Second)
		_ = s.UpdatePayoutStatus(context.Background(), id, "processing", nil, nil)
		// simulate remote processing
		time.Sleep(1 * time.Second)
		ext := fmt.Sprintf("SIM-%d", time.Now().UnixNano())
		_ = s.UpdatePayoutStatus(context.Background(), id, "succeeded", &ext, nil)
	}(p.ID)
	return nil
}

// ListPayoutsForMember returns payouts for a member.
func (s *FinanceService) ListPayoutsForMember(ctx context.Context, memberID string) ([]financemodels.Payout, error) {
	var out []financemodels.Payout
	if err := s.DB.WithContext(ctx).
		Where("member_id = ? AND deleted_at IS NULL", strings.TrimSpace(memberID)).
		Order("created_at desc").
		Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// ListPayoutsForMemberAndBusiness returns payouts for a specific business belonging to a member.
func (s *FinanceService) ListPayoutsForMemberAndBusiness(ctx context.Context, memberID, businessID string) ([]financemodels.Payout, error) {
	var out []financemodels.Payout
	if err := s.DB.WithContext(ctx).
		Where("member_id = ? AND business_id = ? AND deleted_at IS NULL", strings.TrimSpace(memberID), strings.TrimSpace(businessID)).
		Order("created_at desc").
		Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// GetPayoutByID returns a payout by id.
func (s *FinanceService) GetPayoutByID(ctx context.Context, id string) (*financemodels.Payout, error) {
	var out financemodels.Payout
	if err := s.DB.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdatePayoutStatus updates payout status and optional external id / failure reason.
func (s *FinanceService) UpdatePayoutStatus(ctx context.Context, id string, status string, externalID *string, failureReason *string) error {
	updates := map[string]interface{}{"status": status, "updated_at": time.Now()}
	if status != "pending" {
		updates["processed_at"] = time.Now()
	}
	if externalID != nil {
		updates["external_id"] = *externalID
	}
	if failureReason != nil {
		updates["failure_reason"] = *failureReason
	}
	return s.DB.WithContext(ctx).Model(&financemodels.Payout{}).Where("id = ?", strings.TrimSpace(id)).Updates(updates).Error
}
