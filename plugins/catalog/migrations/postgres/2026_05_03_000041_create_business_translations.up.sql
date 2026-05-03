CREATE TABLE IF NOT EXISTS business_translations (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    locale VARCHAR(8) NOT NULL,
    short_description TEXT,
    highlights JSONB,
    story_html TEXT,
    story_plain TEXT,
    story_blocks JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_business_translations_business
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT uq_business_translations_business_locale UNIQUE (business_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_business_translations_locale ON business_translations(locale);