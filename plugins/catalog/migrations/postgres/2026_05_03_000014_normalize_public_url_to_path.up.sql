-- Normalize public_url to path-only values for product_assets
-- 1) If public_url is empty or NULL, set to '/assets/' || file_path
-- 2) Otherwise strip scheme+host (e.g. https://example.com) to leave only the path

UPDATE product_assets
SET public_url = (
  CASE
    WHEN public_url IS NULL OR public_url = '' THEN '/assets/' || file_path
    ELSE regexp_replace(public_url, '^https?://[^/]+', '')
  END
)
WHERE file_path IS NOT NULL;
