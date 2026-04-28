ALTER TABLE business_members
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
    ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE business_members
SET status = COALESCE(NULLIF(status, ''), 'active'),
    status_changed_at = COALESCE(status_changed_at, updated_at, created_at, NOW())
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_members_business_status
    ON business_members (business_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_members_status
    ON business_members (status)
    WHERE deleted_at IS NULL;
