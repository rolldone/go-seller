package models

import (
	"strings"
	"time"

	authmodels "go_framework/plugins/auth/models"
)

// MemberNotificationGroup stores additional recipients that should receive
// notifications for specific withdrawal/balance events on behalf of a business.
// Recipients are modeled through the join table so businesses can select
// existing members instead of typing manual email addresses.
type MemberNotificationGroup struct {
	ID         int64  `gorm:"primaryKey" json:"id"`
	BusinessID string `gorm:"type:uuid;index;not null" json:"business_id"`
	Name       string `gorm:"size:100;not null" json:"name"`
	// EventTypes is stored as a comma-separated list, e.g. "withdrawal_requested,withdrawal_approved"
	EventTypes string                          `gorm:"type:text;not null;default:''" json:"event_types"`
	IsActive   bool                            `gorm:"default:true" json:"is_active"`
	Members    []MemberNotificationGroupMember `gorm:"foreignKey:GroupID;constraint:OnDelete:CASCADE" json:"members,omitempty"`
	CreatedAt  time.Time                       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time                       `gorm:"autoUpdateTime" json:"updated_at"`
}

func (MemberNotificationGroup) TableName() string {
	return "member_notification_groups"
}

// MemberNotificationGroupMember connects a notification group to a business member.
type MemberNotificationGroupMember struct {
	ID        int64            `gorm:"primaryKey" json:"id"`
	GroupID   int64            `gorm:"type:bigint;index;not null" json:"group_id"`
	UserID    string           `gorm:"type:uuid;index;not null" json:"user_id"`
	User      *authmodels.User `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
	CreatedAt time.Time        `gorm:"autoCreateTime" json:"created_at"`
}

func (MemberNotificationGroupMember) TableName() string {
	return "member_notification_group_members"
}

// EventTypesList returns the EventTypes field as a parsed slice.
func (m *MemberNotificationGroup) EventTypesList() []string {
	if m.EventTypes == "" {
		return nil
	}
	parts := strings.Split(m.EventTypes, ",")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// MatchesEvent returns true if this group should receive the given event.
// An empty EventTypes list means "all events".
func (m *MemberNotificationGroup) MatchesEvent(eventKey string) bool {
	list := m.EventTypesList()
	if len(list) == 0 {
		return true
	}
	for _, ev := range list {
		if ev == eventKey {
			return true
		}
	}
	return false
}
