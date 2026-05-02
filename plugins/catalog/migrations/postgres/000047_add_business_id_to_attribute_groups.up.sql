ALTER TABLE attribute_groups
    ADD COLUMN IF NOT EXISTS business_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_attribute_groups_business'
          AND table_name = 'attribute_groups'
    ) THEN
        ALTER TABLE attribute_groups
        ADD CONSTRAINT fk_attribute_groups_business
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
    END IF;
END$$;

ALTER TABLE attribute_groups DROP CONSTRAINT IF EXISTS attribute_groups_slug_key;
DROP INDEX IF EXISTS idx_attribute_groups_slug;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attribute_groups_slug_global
    ON attribute_groups(slug)
    WHERE business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attribute_groups_business_slug
    ON attribute_groups(business_id, slug)
    WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attribute_groups_business_id ON attribute_groups(business_id);