package models

import "time"

type BusinessTeamAudit struct {
	ID               string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BusinessMemberID *string   `gorm:"type:uuid;index" json:"business_member_id,omitempty"`
	TargetUserID     *string   `gorm:"type:uuid;index" json:"target_user_id,omitempty"`
	TargetEmail      *string   `gorm:"size:255" json:"target_email,omitempty"`
	ActorType        string    `gorm:"size:50;not null;index" json:"actor_type"`
	ActorID          *string   `gorm:"type:uuid;index" json:"actor_id,omitempty"`
	Action           string    `gorm:"size:50;not null;index" json:"action"`
	StatusFrom       *string   `gorm:"size:50" json:"status_from,omitempty"`
	StatusTo         *string   `gorm:"size:50" json:"status_to,omitempty"`
	RoleFrom         *string   `gorm:"size:50" json:"role_from,omitempty"`
	RoleTo           *string   `gorm:"size:50" json:"role_to,omitempty"`
	Notes            *string   `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt        time.Time `gorm:"autoCreateTime;index" json:"created_at"`
}

func (BusinessTeamAudit) TableName() string {
	return "business_team_audits"
}

const (
	BusinessTeamAuditActorTypeAdmin  = "admin"
	BusinessTeamAuditActorTypeMember = "member"

	BusinessTeamAuditActionInvite = "invite"
	BusinessTeamAuditActionAccept = "accept"
	BusinessTeamAuditActionStatus = "status"
	BusinessTeamAuditActionRole   = "role"
	BusinessTeamAuditActionRemove = "remove"
)
