package services

import (
	"context"
	"time"

	authmodels "go_framework/plugins/auth/models"
)

// CreateSession stores a new session (refresh token).
func (s *AuthService) CreateSession(ctx context.Context, sess *authmodels.Session) error {
	return s.DB.WithContext(ctx).Create(sess).Error
}

// RevokeSession deletes a session by id.
func (s *AuthService) RevokeSession(ctx context.Context, id string) error {
	return s.DB.WithContext(ctx).Where("id = ?", id).Delete(&authmodels.Session{}).Error
}

// CleanupExpiredSessions removes sessions that already expired.
func (s *AuthService) CleanupExpiredSessions(ctx context.Context) error {
	return s.DB.WithContext(ctx).Where("expires_at <= ?", time.Now()).Delete(&authmodels.Session{}).Error
}
