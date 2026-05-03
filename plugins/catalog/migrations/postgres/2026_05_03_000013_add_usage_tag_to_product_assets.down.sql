-- plugins/catalog/migrations/postgres/YYYYMMDDHHMMSS_add_usage_tag_to_product_assets.down.sql
ALTER TABLE product_assets
DROP COLUMN usage_tag;
-- write your DOWN migration here
