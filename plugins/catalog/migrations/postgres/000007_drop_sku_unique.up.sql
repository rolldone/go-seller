ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_sku_key;

DROP INDEX IF EXISTS idx_products_sku;
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
