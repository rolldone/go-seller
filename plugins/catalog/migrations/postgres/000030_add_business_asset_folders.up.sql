CREATE TABLE IF NOT EXISTS business_asset_folders (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    parent_id UUID NULL,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(160) NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_business_asset_folders_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_business_asset_folders_parent FOREIGN KEY (parent_id) REFERENCES business_asset_folders(id) ON DELETE SET NULL,
    CONSTRAINT uq_business_asset_folders_path UNIQUE (business_id, path)
);

CREATE INDEX IF NOT EXISTS idx_business_asset_folders_business_id ON business_asset_folders(business_id);
CREATE INDEX IF NOT EXISTS idx_business_asset_folders_parent_id ON business_asset_folders(parent_id);

ALTER TABLE business_assets
    ADD COLUMN IF NOT EXISTS folder_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_business_assets_folder'
          AND table_name = 'business_assets'
    ) THEN
        ALTER TABLE business_assets
            ADD CONSTRAINT fk_business_assets_folder
            FOREIGN KEY (folder_id) REFERENCES business_asset_folders(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_business_assets_folder_id ON business_assets(folder_id);
