-- plugins/catalog/migrations/postgres/000035_create_business_disclaimer_translations.up.sql
CREATE TABLE IF NOT EXISTS business_disclaimer_translations (
    id UUID PRIMARY KEY,
    business_disclaimer_id UUID NOT NULL,
    locale VARCHAR(8) NOT NULL,
    title TEXT,
    content_html TEXT,
    content_plain TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_business_disclaimer_translations_disclaimer'
          AND table_name = 'business_disclaimer_translations'
    ) THEN
        ALTER TABLE business_disclaimer_translations
        ADD CONSTRAINT fk_business_disclaimer_translations_disclaimer
        FOREIGN KEY (business_disclaimer_id) REFERENCES business_disclaimers(id) ON DELETE CASCADE;
    END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_disclaimer_translations_locale
    ON business_disclaimer_translations(business_disclaimer_id, locale)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_disclaimer_translations_deleted_at
    ON business_disclaimer_translations(deleted_at) WHERE deleted_at IS NULL;