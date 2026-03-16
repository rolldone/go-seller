ALTER TABLE discounts
    ADD COLUMN code VARCHAR(100);

UPDATE discounts
    SET code = format('discount-%s', substr(id::text, 1, 8))
    WHERE code IS NULL;

ALTER TABLE discounts
    ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
