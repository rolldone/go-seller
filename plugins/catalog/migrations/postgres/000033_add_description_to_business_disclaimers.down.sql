-- plugins/catalog/migrations/postgres/000033_add_description_to_business_disclaimers.down.sql
ALTER TABLE business_disclaimers
DROP COLUMN IF EXISTS description;