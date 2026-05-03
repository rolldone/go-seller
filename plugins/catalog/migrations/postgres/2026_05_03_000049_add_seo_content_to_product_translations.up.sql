ALTER TABLE product_translations
    ADD COLUMN IF NOT EXISTS seo_content JSONB;
