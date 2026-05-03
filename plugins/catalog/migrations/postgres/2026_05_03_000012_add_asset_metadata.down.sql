-- Remove metadata columns from product_assets
ALTER TABLE product_assets
    DROP COLUMN IF EXISTS public_url,
    DROP COLUMN IF EXISTS original_name,
    DROP COLUMN IF EXISTS file_size,
    DROP COLUMN IF EXISTS mime_type;

-- Drop index
DROP INDEX IF EXISTS idx_product_assets_product_id;
