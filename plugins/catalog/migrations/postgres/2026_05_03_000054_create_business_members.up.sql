CREATE TABLE IF NOT EXISTS business_members (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_members_business_user_active
    ON business_members (business_id, user_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_members_owner_per_business
    ON business_members (business_id)
    WHERE is_owner = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_members_user_id
    ON business_members (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_members_business_id
    ON business_members (business_id)
    WHERE deleted_at IS NULL;