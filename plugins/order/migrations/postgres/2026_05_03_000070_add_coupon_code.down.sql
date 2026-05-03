DROP INDEX IF EXISTS idx_orders_coupon_code;
ALTER TABLE orders DROP COLUMN IF EXISTS coupon_code;
