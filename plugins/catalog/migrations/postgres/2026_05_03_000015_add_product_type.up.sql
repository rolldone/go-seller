-- 000005_add_product_type.up.sql
-- Add product_type enum and column to products
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type_enum') THEN
        CREATE TYPE product_type_enum AS ENUM ('product', 'service', 'digital');
    END IF;
END$$;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_type product_type_enum DEFAULT 'product';

-- index for filtering
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
