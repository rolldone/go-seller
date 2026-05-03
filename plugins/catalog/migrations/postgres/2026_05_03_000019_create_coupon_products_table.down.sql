ALTER TABLE coupons ADD COLUMN IF NOT EXISTS product_id UUID;

UPDATE coupons
        SET product_id = cp.product_id
        FROM (
                SELECT coupon_id, MIN(product_id::text)::uuid AS product_id
                FROM coupon_products
                GROUP BY coupon_id
        ) cp
        WHERE coupons.id = cp.coupon_id AND coupons.product_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_product_id ON coupons(product_id);

DROP TABLE IF EXISTS coupon_products;
