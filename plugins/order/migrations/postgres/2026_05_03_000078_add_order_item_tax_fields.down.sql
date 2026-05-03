ALTER TABLE order_items
    DROP COLUMN IF EXISTS tax_rate,
    DROP COLUMN IF EXISTS tax_type;
