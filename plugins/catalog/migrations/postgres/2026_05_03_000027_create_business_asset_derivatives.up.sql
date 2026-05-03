-- Create business_asset_derivatives table
CREATE TABLE IF NOT EXISTS business_asset_derivatives (
    id UUID PRIMARY KEY,
    asset_id UUID,
    file_path TEXT NOT NULL,
    file_type VARCHAR(10),
    mime_type VARCHAR(100),
    width INT,
    height INT,
    file_size BIGINT DEFAULT 0,
    purpose VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_bad_asset FOREIGN KEY (asset_id) REFERENCES business_assets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bad_asset_id ON business_asset_derivatives(asset_id);
CREATE INDEX IF NOT EXISTS idx_bad_purpose ON business_asset_derivatives(purpose);
