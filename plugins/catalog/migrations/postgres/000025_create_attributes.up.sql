CREATE TABLE IF NOT EXISTS attributes (
    id UUID PRIMARY KEY,
    attribute_group_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_attributes_group
        FOREIGN KEY (attribute_group_id) REFERENCES attribute_groups(id) ON DELETE CASCADE,
    CONSTRAINT uq_attributes_group_slug UNIQUE (attribute_group_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_attributes_group ON attributes(attribute_group_id);
CREATE INDEX IF NOT EXISTS idx_attributes_is_active ON attributes(is_active);
