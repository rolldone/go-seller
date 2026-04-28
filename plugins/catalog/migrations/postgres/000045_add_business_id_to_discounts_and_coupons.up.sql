ALTER TABLE discounts
    ADD COLUMN IF NOT EXISTS business_id UUID;

ALTER TABLE coupons
    ADD COLUMN IF NOT EXISTS business_id UUID;

CREATE INDEX IF NOT EXISTS idx_discounts_business_id ON discounts(business_id);
CREATE INDEX IF NOT EXISTS idx_coupons_business_id ON coupons(business_id);