-- Add category column to coupons for multi-coupon stacking rules.
-- Categories: discount, cashback, shipping, product
-- Two coupons of the same category cannot be combined on the same order.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'discount';

CREATE INDEX IF NOT EXISTS idx_coupons_category ON coupons(category);
