DROP INDEX IF EXISTS ux_cart_items_cart_product_variant;
DROP INDEX IF EXISTS ux_cart_items_cart_product_novariant;
DROP INDEX IF EXISTS ux_cart_items_cart_product_variation;
DROP INDEX IF EXISTS idx_cart_items_variation_id;
DROP INDEX IF EXISTS idx_cart_items_product_id;
DROP INDEX IF EXISTS idx_cart_items_cart_id;

ALTER TABLE IF EXISTS cart_items DROP COLUMN IF EXISTS image_url;
ALTER TABLE IF EXISTS cart_items DROP COLUMN IF EXISTS sku;
ALTER TABLE IF EXISTS cart_items DROP COLUMN IF EXISTS variation_id;
ALTER TABLE IF EXISTS cart_items DROP COLUMN IF EXISTS business_name;
ALTER TABLE IF EXISTS cart_items DROP COLUMN IF EXISTS product_name;
ALTER TABLE IF EXISTS cart_items DROP COLUMN IF EXISTS total;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_cart_product
	ON cart_items(cart_id, product_id);

DROP INDEX IF EXISTS ux_carts_active_customer_business;
DROP INDEX IF EXISTS idx_carts_status;
DROP INDEX IF EXISTS idx_carts_customer_id;

ALTER TABLE IF EXISTS carts ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_carts_active_user_business
	ON carts(user_id, business_id)
	WHERE status = 'active' AND deleted_at IS NULL;

-- Do not force legacy NOT NULL/FK here to avoid rollback failure when
-- customer-owned rows no longer map to users(id).

ALTER TABLE IF EXISTS carts DROP COLUMN IF EXISTS customer_id;
