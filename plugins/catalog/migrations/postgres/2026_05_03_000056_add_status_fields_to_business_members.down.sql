DROP INDEX IF EXISTS idx_business_members_status;
DROP INDEX IF EXISTS idx_business_members_business_status;

ALTER TABLE business_members
    DROP COLUMN IF EXISTS invited_by,
    DROP COLUMN IF EXISTS suspension_reason,
    DROP COLUMN IF EXISTS suspended_at,
    DROP COLUMN IF EXISTS status_changed_at,
    DROP COLUMN IF EXISTS invited_at,
    DROP COLUMN IF EXISTS status;
