DROP INDEX IF EXISTS idx_discounts_business_id;
DROP INDEX IF EXISTS idx_coupons_business_id;

ALTER TABLE discounts
    DROP COLUMN IF EXISTS business_id;

ALTER TABLE coupons
    DROP COLUMN IF EXISTS business_id;