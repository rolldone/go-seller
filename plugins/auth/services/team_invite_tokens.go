package services

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type TeamInviteClaims struct {
	SubjectID  string
	Level      string
	Email      string
	BusinessID string
	Role       string
	InvitedBy  string
}

var teamInviteSecret = loadTeamInviteSecret()

func loadTeamInviteSecret() string {
	if value := strings.TrimSpace(os.Getenv("AUTH_JWT_SECRET")); value != "" {
		return value
	}
	if value := strings.TrimSpace(os.Getenv("JWT_ACCESS_SECRET")); value != "" {
		return value
	}
	return "change-me-access-secret"
}

func GenerateTeamInviteToken(subjectID string, ttl time.Duration, claims TeamInviteClaims) (string, time.Time, error) {
	if strings.TrimSpace(teamInviteSecret) == "" {
		return "", time.Time{}, errors.New("jwt secret is empty")
	}
	exp := time.Now().Add(ttl)
	jwtClaims := jwt.MapClaims{
		"sub":         strings.TrimSpace(subjectID),
		"level":       "member_team_invite",
		"email":       strings.TrimSpace(claims.Email),
		"business_id": strings.TrimSpace(claims.BusinessID),
		"role":        strings.TrimSpace(claims.Role),
		"invited_by":  strings.TrimSpace(claims.InvitedBy),
		"iat":         time.Now().Unix(),
		"exp":         exp.Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims)
	signed, err := tok.SignedString([]byte(teamInviteSecret))
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

func ParseTeamInviteClaims(token string) (*TeamInviteClaims, error) {
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("empty token")
	}
	if strings.TrimSpace(teamInviteSecret) == "" {
		return nil, errors.New("jwt secret is empty")
	}
	tok, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(teamInviteSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if !tok.Valid {
		return nil, errors.New("invalid token")
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid claims")
	}
	level, _ := claims["level"].(string)
	if level != "member_team_invite" {
		return nil, errors.New("invalid invite token")
	}
	return &TeamInviteClaims{
		SubjectID:  stringValue(claims["sub"]),
		Level:      level,
		Email:      stringValue(claims["email"]),
		BusinessID: stringValue(claims["business_id"]),
		Role:       stringValue(claims["role"]),
		InvitedBy:  stringValue(claims["invited_by"]),
	}, nil
}

func stringValue(value any) string {
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text)
	}
	return ""
}
