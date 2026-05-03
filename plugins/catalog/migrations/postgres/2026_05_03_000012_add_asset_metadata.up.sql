-- Add metadata columns to product_assets for better file management
ALTER TABLE product_assets
    ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS original_name TEXT,
    ADD COLUMN IF NOT EXISTS public_url TEXT;

-- Add index on product_id for faster queries
CREATE INDEX IF NOT EXISTS idx_product_assets_product_id ON product_assets(product_id);
