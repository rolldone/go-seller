ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_business;
DROP INDEX IF EXISTS idx_products_business_id;
ALTER TABLE products DROP COLUMN IF EXISTS business_id;

DROP INDEX IF EXISTS idx_businesses_slug;
DROP INDEX IF EXISTS idx_businesses_deleted_at;
DROP TABLE IF EXISTS businesses;