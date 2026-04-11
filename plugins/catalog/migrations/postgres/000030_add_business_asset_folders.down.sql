DROP INDEX IF EXISTS idx_business_assets_folder_id;

ALTER TABLE business_assets
    DROP CONSTRAINT IF EXISTS fk_business_assets_folder;

ALTER TABLE business_assets
    DROP COLUMN IF EXISTS folder_id;

DROP INDEX IF EXISTS idx_business_asset_folders_parent_id;
DROP INDEX IF EXISTS idx_business_asset_folders_business_id;
DROP TABLE IF EXISTS business_asset_folders;
