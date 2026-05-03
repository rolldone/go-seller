-- Create order_coupons table and remove legacy coupon_code column.
CREATE TABLE IF NOT EXISTS order_coupons (
	id UUID PRIMARY KEY,
	order_id UUID NOT NULL,
	code VARCHAR(100) NOT NULL,
	category VARCHAR(50) NOT NULL DEFAULT 'discount',
	discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_coupons_order_id ON order_coupons(order_id);
CREATE INDEX IF NOT EXISTS idx_order_coupons_code ON order_coupons(code);

ALTER TABLE orders DROP COLUMN IF EXISTS coupon_code;
