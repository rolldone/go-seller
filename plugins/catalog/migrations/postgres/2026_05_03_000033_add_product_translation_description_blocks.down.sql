ALTER TABLE product_translations
    DROP COLUMN IF EXISTS description_html,
    DROP COLUMN IF EXISTS description_plain,
    DROP COLUMN IF EXISTS description_blocks;
