DROP INDEX IF EXISTS idx_discounts_priority;
ALTER TABLE discounts
    DROP COLUMN IF EXISTS priority;
