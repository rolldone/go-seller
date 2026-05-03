CREATE TABLE IF NOT EXISTS business_team_audits (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    business_member_id UUID NULL REFERENCES business_members(id) ON DELETE SET NULL,
    target_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    target_email VARCHAR(255) NULL,
    actor_type VARCHAR(50) NOT NULL,
    actor_id UUID NULL,
    action VARCHAR(50) NOT NULL,
    status_from VARCHAR(50) NULL,
    status_to VARCHAR(50) NULL,
    role_from VARCHAR(50) NULL,
    role_to VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_team_audits_business_id ON business_team_audits (business_id);
CREATE INDEX IF NOT EXISTS idx_business_team_audits_business_member_id ON business_team_audits (business_member_id);
CREATE INDEX IF NOT EXISTS idx_business_team_audits_actor_id ON business_team_audits (actor_id);
CREATE INDEX IF NOT EXISTS idx_business_team_audits_action ON business_team_audits (action);
CREATE INDEX IF NOT EXISTS idx_business_team_audits_created_at ON business_team_audits (created_at);