-- Create business_assets table
CREATE TABLE IF NOT EXISTS business_assets (
    id UUID PRIMARY KEY,
    business_id UUID,
    file_path TEXT NOT NULL,
    file_type VARCHAR(10),
    mime_type VARCHAR(100),
    file_size BIGINT DEFAULT 0,
    original_name TEXT,
    public_url TEXT,
    is_main BOOLEAN DEFAULT FALSE,
    usage_tag VARCHAR(50),
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_business_assets_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_assets_business_id ON business_assets(business_id);
CREATE INDEX IF NOT EXISTS idx_business_assets_usage_tag ON business_assets(usage_tag);
