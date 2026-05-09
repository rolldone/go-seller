-- Remove legacy fields from payment_methods to keep the admin UX simple.
DROP INDEX IF EXISTS idx_payment_methods_code;
DROP INDEX IF EXISTS idx_payment_methods_category;

ALTER TABLE payment_methods DROP COLUMN IF EXISTS code;
ALTER TABLE payment_methods DROP COLUMN IF EXISTS category;
ALTER TABLE payment_methods DROP COLUMN IF EXISTS icon_url;
