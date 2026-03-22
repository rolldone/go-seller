ALTER TABLE product_translations
    ADD COLUMN IF NOT EXISTS description_html TEXT,
    ADD COLUMN IF NOT EXISTS description_plain TEXT,
    ADD COLUMN IF NOT EXISTS description_blocks JSONB;

UPDATE product_translations
SET
    description_html = COALESCE(description_html, description),
    description_plain = COALESCE(description_plain, description)
WHERE description IS NOT NULL;
