-- Allow each coupon to target many products via a mapping table.
CREATE TABLE IF NOT EXISTS coupon_products (
        coupon_id UUID NOT NULL,
        product_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (coupon_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_products_coupon_id ON coupon_products(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_products_product_id ON coupon_products(product_id);

ALTER TABLE coupon_products
        ADD CONSTRAINT fk_coupon_products_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE;
ALTER TABLE coupon_products
        ADD CONSTRAINT fk_coupon_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

INSERT INTO coupon_products (coupon_id, product_id)
        SELECT id, product_id FROM coupons WHERE product_id IS NOT NULL;

DROP INDEX IF EXISTS idx_coupons_product_id;
ALTER TABLE coupons DROP COLUMN IF EXISTS product_id;
