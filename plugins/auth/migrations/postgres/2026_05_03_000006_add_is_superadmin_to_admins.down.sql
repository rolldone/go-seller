DROP INDEX IF EXISTS idx_admins_is_superadmin;

ALTER TABLE admins
    DROP COLUMN IF EXISTS is_superadmin;
