ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS locale VARCHAR(8) NOT NULL DEFAULT 'id';

UPDATE customers
SET locale = 'id'
WHERE locale IS NULL OR TRIM(locale) = '';

-- Keep only currently supported locales.
UPDATE customers
SET locale = 'id'
WHERE LOWER(locale) NOT IN ('id', 'en');
