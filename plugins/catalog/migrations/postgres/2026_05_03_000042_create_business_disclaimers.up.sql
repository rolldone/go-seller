-- plugins/catalog/migrations/postgres/000032_create_business_disclaimers.up.sql
CREATE TABLE IF NOT EXISTS business_disclaimers (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    content_html TEXT,
    content_plain TEXT,
    icon_key VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_business_disclaimers_business'
          AND table_name = 'business_disclaimers'
    ) THEN
        ALTER TABLE business_disclaimers
        ADD CONSTRAINT fk_business_disclaimers_business
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_business_disclaimers_business_id ON business_disclaimers(business_id);
CREATE INDEX IF NOT EXISTS idx_business_disclaimers_deleted_at ON business_disclaimers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_disclaimers_sort_order ON business_disclaimers(sort_order);
