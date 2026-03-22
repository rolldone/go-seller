package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go_framework/internal/keydb"
	"go_framework/plugins/order/models"

	"github.com/redis/go-redis/v9"
)

const (
	guestCheckoutTokenTTL      = time.Hour
	guestCheckoutTokenPrefix   = "guest_checkout:token:"
	guestCheckoutOrderPrefix   = "guest_checkout:order:"
	guestCheckoutUsedPrefix    = "guest_checkout:used:"
	guestCheckoutRevokedPrefix = "guest_checkout:revoked:"
)

type GuestCheckoutTokenPayload struct {
	Token         string       `json:"token"`
	OrderID       string       `json:"order_id"`
	CustomerID    string       `json:"customer_id"`
	OrderSnapshot models.Order `json:"order_snapshot"`
	IssuedAt      time.Time    `json:"issued_at"`
	ExpiresAt     time.Time    `json:"expires_at"`
}

func guestCheckoutTokenKey(token string) string {
	return guestCheckoutTokenPrefix + strings.TrimSpace(token)
}

func guestCheckoutOrderKey(orderID string) string {
	return guestCheckoutOrderPrefix + strings.TrimSpace(orderID)
}

func guestCheckoutUsedKey(token string) string {
	return guestCheckoutUsedPrefix + strings.TrimSpace(token)
}

func guestCheckoutRevokedKey(token string) string {
	return guestCheckoutRevokedPrefix + strings.TrimSpace(token)
}

func randomShortToken(lengthBytes int) (string, error) {
	if lengthBytes <= 0 {
		lengthBytes = 12
	}
	buf := make([]byte, lengthBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func (s *OrderService) GenerateGuestCheckoutToken(ctx context.Context, orderID string, ttl time.Duration) (*GuestCheckoutTokenPayload, error) {
	if keydb.Client == nil {
		return nil, errors.New("keydb client is not initialized")
	}
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil, errors.New("order_id is required")
	}
	if ttl <= 0 {
		ttl = guestCheckoutTokenTTL
	}

	order, err := s.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.CustomerID == nil || strings.TrimSpace(*order.CustomerID) == "" {
		return nil, errors.New("order has no customer_id")
	}

	now := time.Now().UTC()
	var token string
	for i := 0; i < 5; i++ {
		candidate, genErr := randomShortToken(12)
		if genErr != nil {
			return nil, fmt.Errorf("failed to generate token: %w", genErr)
		}
		exists, existsErr := keydb.Client.Exists(ctx, guestCheckoutTokenKey(candidate)).Result()
		if existsErr != nil {
			return nil, existsErr
		}
		if exists == 0 {
			token = candidate
			break
		}
	}
	if token == "" {
		return nil, errors.New("failed to generate unique token")
	}

	payload := &GuestCheckoutTokenPayload{
		Token:         token,
		OrderID:       order.ID,
		CustomerID:    strings.TrimSpace(*order.CustomerID),
		OrderSnapshot: *order,
		IssuedAt:      now,
		ExpiresAt:     now.Add(ttl),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	if err := keydb.Client.Set(ctx, guestCheckoutTokenKey(token), data, ttl).Err(); err != nil {
		return nil, err
	}
	if err := keydb.Client.Set(ctx, guestCheckoutOrderKey(order.ID), token, ttl).Err(); err != nil {
		return nil, err
	}

	return payload, nil
}

func (s *OrderService) ResolveGuestCheckoutToken(ctx context.Context, token string) (*GuestCheckoutTokenPayload, error) {
	if keydb.Client == nil {
		return nil, errors.New("keydb client is not initialized")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, errors.New("token is required")
	}
	// if token is revoked (completed), return a distinct error so caller can handle
	revoked, rErr := keydb.Client.Exists(ctx, guestCheckoutRevokedKey(token)).Result()
	if rErr == nil && revoked > 0 {
		return nil, errors.New("token revoked")
	}
	used, usedErr := keydb.Client.Exists(ctx, guestCheckoutUsedKey(token)).Result()
	if usedErr != nil {
		return nil, usedErr
	}
	if used > 0 {
		return nil, errors.New("token already used")
	}

	raw, err := keydb.Client.Get(ctx, guestCheckoutTokenKey(token)).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, errors.New("token invalid or expired")
		}
		return nil, err
	}

	var payload GuestCheckoutTokenPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	if payload.Token == "" {
		payload.Token = token
	}
	if payload.ExpiresAt.Before(time.Now().UTC()) {
		return nil, errors.New("token expired")
	}

	order, err := s.GetOrderByID(ctx, payload.OrderID)
	if err != nil {
		return nil, err
	}
	if order.CustomerID == nil || strings.TrimSpace(*order.CustomerID) == "" {
		return nil, errors.New("order has no customer_id")
	}
	if strings.TrimSpace(*order.CustomerID) != strings.TrimSpace(payload.CustomerID) {
		return nil, errors.New("token customer mismatch")
	}

	return &payload, nil
}

func RevokeGuestCheckoutToken(ctx context.Context, token string) error {
	if keydb.Client == nil {
		return nil
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil
	}
	payloadRaw, err := keydb.Client.Get(ctx, guestCheckoutTokenKey(token)).Bytes()
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}
	if len(payloadRaw) > 0 {
		var payload GuestCheckoutTokenPayload
		if json.Unmarshal(payloadRaw, &payload) == nil && strings.TrimSpace(payload.OrderID) != "" {
			_ = keydb.Client.Del(ctx, guestCheckoutOrderKey(payload.OrderID)).Err()
		}
	}
	// set a revoked marker so clients can show a friendly message when revisiting
	// keep the marker for a reasonable duration (use original token TTL * 24 as example)
	_ = keydb.Client.Set(ctx, guestCheckoutRevokedKey(token), time.Now().UTC().Format(time.RFC3339Nano), guestCheckoutTokenTTL*24).Err()
	if err := keydb.Client.Del(ctx, guestCheckoutTokenKey(token)).Err(); err != nil {
		return err
	}
	return keydb.Client.Del(ctx, guestCheckoutUsedKey(token)).Err()
}

func RevokeGuestCheckoutTokenByOrderID(ctx context.Context, orderID string) error {
	if keydb.Client == nil {
		return nil
	}
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil
	}
	token, err := keydb.Client.Get(ctx, guestCheckoutOrderKey(orderID)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil
		}
		return err
	}
	if err := keydb.Client.Del(ctx, guestCheckoutOrderKey(orderID)).Err(); err != nil {
		return err
	}
	if strings.TrimSpace(token) != "" {
		if err := keydb.Client.Del(ctx, guestCheckoutTokenKey(token)).Err(); err != nil {
			return err
		}
		if err := keydb.Client.Del(ctx, guestCheckoutUsedKey(token)).Err(); err != nil {
			return err
		}
	}
	return nil
}

func AcquireGuestCheckoutTokenUse(ctx context.Context, token string, ttl time.Duration) (bool, error) {
	if keydb.Client == nil {
		return false, errors.New("keydb client is not initialized")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return false, errors.New("token is required")
	}
	if ttl <= 0 {
		ttl = guestCheckoutTokenTTL
	}
	return keydb.Client.SetNX(ctx, guestCheckoutUsedKey(token), time.Now().UTC().Format(time.RFC3339Nano), ttl).Result()
}

func ReleaseGuestCheckoutTokenUse(ctx context.Context, token string) error {
	if keydb.Client == nil {
		return nil
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil
	}
	return keydb.Client.Del(ctx, guestCheckoutUsedKey(token)).Err()
}
