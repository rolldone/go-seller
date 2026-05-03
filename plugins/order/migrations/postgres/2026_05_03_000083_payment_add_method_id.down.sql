-- 000015_payment_add_method_id.down.sql
ALTER TABLE payments DROP COLUMN IF EXISTS payment_method_id;
