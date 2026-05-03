CREATE TABLE IF NOT EXISTS category_translations (
    id UUID PRIMARY KEY,
    category_id UUID NOT NULL,
    locale VARCHAR(8) NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    seo_content JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_category_translations_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT uq_category_translations_category_locale UNIQUE (category_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_category_translations_locale ON category_translations(locale);