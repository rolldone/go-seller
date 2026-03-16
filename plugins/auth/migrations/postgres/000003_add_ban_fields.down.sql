-- Remove rich ban record fields from admins and users

DROP INDEX IF EXISTS idx_admins_is_banned;
DROP INDEX IF EXISTS idx_users_is_banned;

ALTER TABLE admins
    DROP COLUMN IF EXISTS banned_by,
    DROP COLUMN IF EXISTS ban_reason,
    DROP COLUMN IF EXISTS banned_until,
    DROP COLUMN IF EXISTS banned_at,
    DROP COLUMN IF EXISTS is_banned;

ALTER TABLE users
    DROP COLUMN IF EXISTS banned_by,
    DROP COLUMN IF EXISTS ban_reason,
    DROP COLUMN IF EXISTS banned_until,
    DROP COLUMN IF EXISTS banned_at,
    DROP COLUMN IF EXISTS is_banned;
