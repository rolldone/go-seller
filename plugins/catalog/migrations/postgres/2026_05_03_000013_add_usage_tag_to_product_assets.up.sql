-- write your UP migration here
-- plugins/catalog/migrations/postgres/YYYYMMDDHHMMSS_add_usage_tag_to_product_assets.up.sql
ALTER TABLE product_assets
ADD COLUMN usage_tag VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN product_assets.usage_tag IS 'A tag to identify the specific use case of the asset, e.g., "thumbnail", "social_4_5", "desktop_banner".';
