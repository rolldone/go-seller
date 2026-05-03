CREATE TABLE IF NOT EXISTS product_translations (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL,
    locale VARCHAR(8) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    short_description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_product_translations_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT uq_product_translations_product_locale UNIQUE (product_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_product_translations_locale ON product_translations(locale);
