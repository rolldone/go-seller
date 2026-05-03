-- plugins/catalog/migrations/postgres/000034_rename_business_disclaimers_description_to_title.down.sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'business_disclaimers'
          AND column_name = 'title'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'business_disclaimers'
          AND column_name = 'description'
    ) THEN
        ALTER TABLE business_disclaimers RENAME COLUMN title TO description;
    END IF;
END$$;