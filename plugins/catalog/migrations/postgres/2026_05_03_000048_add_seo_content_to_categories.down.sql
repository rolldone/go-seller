-- Remove SEO content column from categories
ALTER TABLE categories
  DROP COLUMN IF EXISTS seo_content;
