ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_admins_is_superadmin ON admins(is_superadmin);
