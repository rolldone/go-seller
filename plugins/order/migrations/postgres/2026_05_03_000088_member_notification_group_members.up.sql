CREATE TABLE IF NOT EXISTS member_notification_group_members (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES member_notification_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_notification_group_members_group_id
    ON member_notification_group_members (group_id);

CREATE INDEX IF NOT EXISTS idx_member_notification_group_members_user_id
    ON member_notification_group_members (user_id);

-- Backfill existing legacy email-based groups into member-based recipients when possible.
INSERT INTO member_notification_group_members (group_id, user_id, created_at)
SELECT DISTINCT g.id, u.id, NOW()
FROM member_notification_groups g
JOIN business_members bm
    ON bm.business_id = g.business_id
   AND bm.deleted_at IS NULL
   AND COALESCE(NULLIF(bm.status, ''), 'active') = 'active'
JOIN users u
    ON u.id = bm.user_id
   AND u.deleted_at IS NULL
WHERE g.email IS NOT NULL
  AND TRIM(g.email) <> ''
  AND LOWER(u.email) = LOWER(g.email)
ON CONFLICT (group_id, user_id) DO NOTHING;
