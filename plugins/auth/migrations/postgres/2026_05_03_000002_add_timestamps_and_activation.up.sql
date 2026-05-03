-- Add updated_at, deleted_at, and is_activated_at columns for admins and users

-- admins
ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS is_activated_at TIMESTAMPTZ NULL;

-- users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS is_activated_at TIMESTAMPTZ NULL;

-- Optionally update existing rows' updated_at to created_at if desired
UPDATE admins SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
