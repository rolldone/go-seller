-- Rollback tax fields and price override flag from products
DROP INDEX IF EXISTS idx_products_price_override_enabled;
DROP INDEX IF EXISTS idx_products_custom_tax;
DROP INDEX IF EXISTS idx_products_tax_rate;
DROP INDEX IF EXISTS idx_products_tax_type;

ALTER TABLE products
    DROP COLUMN IF EXISTS price_override_enabled,
    DROP COLUMN IF EXISTS custom_tax,
    DROP COLUMN IF EXISTS tax_rate,
    DROP COLUMN IF EXISTS tax_type;
