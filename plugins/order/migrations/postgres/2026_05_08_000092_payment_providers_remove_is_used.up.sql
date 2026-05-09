DROP INDEX IF EXISTS idx_payment_providers_is_used;

ALTER TABLE payment_providers
DROP COLUMN IF EXISTS is_used;