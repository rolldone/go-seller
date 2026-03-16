-- Reverse of 000002: remove columns added to admins and users

-- admins
ALTER TABLE admins
    DROP COLUMN IF EXISTS is_activated_at,
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS updated_at;

-- users
ALTER TABLE users
    DROP COLUMN IF EXISTS is_activated_at,
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS updated_at;
