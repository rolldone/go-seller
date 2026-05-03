ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS tax_type VARCHAR(16) NOT NULL DEFAULT 'exclude',
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0;

UPDATE order_items
SET tax_type = COALESCE(NULLIF(tax_type, ''), 'exclude'),
    tax_rate = COALESCE(tax_rate, 0)
WHERE tax_type IS NULL OR tax_rate IS NULL;
