-- Rollback: set public_url to NULL for rows normalized by the up migration
-- NOTE: This will clear public_url values. If you need to restore previous full URLs,
-- keep a backup before running the migration.

UPDATE product_assets
SET public_url = NULL
WHERE file_path IS NOT NULL;
