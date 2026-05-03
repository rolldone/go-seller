ALTER TABLE categories
    DROP COLUMN IF EXISTS short_description,
    DROP COLUMN IF EXISTS description_blocks,
    DROP COLUMN IF EXISTS description_plain,
    DROP COLUMN IF EXISTS description_html,
    DROP COLUMN IF EXISTS description;