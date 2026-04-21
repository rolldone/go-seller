-- Add SEO content JSONB column to categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS seo_content JSONB;
