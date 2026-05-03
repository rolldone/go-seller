ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS description_html TEXT,
    ADD COLUMN IF NOT EXISTS description_plain TEXT,
    ADD COLUMN IF NOT EXISTS description_blocks JSONB,
    ADD COLUMN IF NOT EXISTS short_description TEXT;