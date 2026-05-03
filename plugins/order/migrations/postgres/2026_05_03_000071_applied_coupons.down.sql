DROP INDEX IF EXISTS idx_order_coupons_order_id;
DROP INDEX IF EXISTS idx_order_coupons_code;
DROP TABLE IF EXISTS order_coupons;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON orders(coupon_code);
