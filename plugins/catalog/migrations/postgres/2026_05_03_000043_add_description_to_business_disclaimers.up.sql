-- plugins/catalog/migrations/postgres/000033_add_description_to_business_disclaimers.up.sql
ALTER TABLE business_disclaimers
ADD COLUMN IF NOT EXISTS description TEXT;