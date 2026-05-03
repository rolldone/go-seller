CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS business_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_products_business'
          AND table_name = 'products'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT fk_products_business
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_businesses_deleted_at ON businesses(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);