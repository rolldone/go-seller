DROP INDEX IF EXISTS uq_attribute_groups_business_slug;
DROP INDEX IF EXISTS uq_attribute_groups_slug_global;
DROP INDEX IF EXISTS idx_attribute_groups_business_id;

ALTER TABLE attribute_groups DROP CONSTRAINT IF EXISTS fk_attribute_groups_business;

ALTER TABLE attribute_groups DROP COLUMN IF EXISTS business_id;

ALTER TABLE attribute_groups
    ADD CONSTRAINT attribute_groups_slug_key UNIQUE (slug);

CREATE INDEX IF NOT EXISTS idx_attribute_groups_slug ON attribute_groups(slug);