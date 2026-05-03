-- Bring the historical carts table up to the customer-owned cart shape.
ALTER TABLE IF EXISTS carts ADD COLUMN IF NOT EXISTS customer_id UUID;

-- Backfill customer_id from legacy user_id data when present.
UPDATE carts
SET customer_id = user_id
WHERE customer_id IS NULL
    AND user_id IS NOT NULL;

-- Legacy carts schema enforces user_id as NOT NULL + FK to users.
-- Customer-authenticated cart flow should not depend on users table.
ALTER TABLE IF EXISTS carts DROP CONSTRAINT IF EXISTS fk_carts_user;

-- Remove legacy user-based cart uniqueness/indexes.
DROP INDEX IF EXISTS ux_carts_active_user_business;
DROP INDEX IF EXISTS idx_carts_user_id;

-- carts ownership has moved to customer_id; remove legacy user_id column.
ALTER TABLE IF EXISTS carts DROP COLUMN IF EXISTS user_id;

-- Ensure active carts are customer-owned.
ALTER TABLE IF EXISTS carts ALTER COLUMN customer_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_carts_active_customer_business
    ON carts(customer_id, business_id)
    WHERE status = 'active' AND deleted_at IS NULL;

-- Bring the historical cart_items table up to the current item snapshot shape.
ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS business_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS variation_id UUID NULL;
ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NULL;
ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS image_url TEXT NULL;
ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS total NUMERIC(15,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variation_id ON cart_items(variation_id);

-- Remove legacy uniqueness that only allowed one row per cart + product.
DROP INDEX IF EXISTS ux_cart_items_cart_product;
DROP INDEX IF EXISTS ux_cart_items_cart_product_variation;

-- Enforce uniqueness separately for variant and non-variant items.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_cart_product_novariant
    ON cart_items(cart_id, product_id)
    WHERE variation_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_cart_product_variant
    ON cart_items(cart_id, product_id, variation_id)
    WHERE variation_id IS NOT NULL;
