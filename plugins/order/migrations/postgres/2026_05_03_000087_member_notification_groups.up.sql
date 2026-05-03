CREATE TABLE IF NOT EXISTS member_notification_groups (
    id          BIGSERIAL PRIMARY KEY,
    business_id UUID         NOT NULL,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    event_types TEXT         NOT NULL DEFAULT '',
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_notification_groups_business_id ON member_notification_groups (business_id);
CREATE INDEX IF NOT EXISTS idx_member_notification_groups_active ON member_notification_groups (business_id, is_active);
