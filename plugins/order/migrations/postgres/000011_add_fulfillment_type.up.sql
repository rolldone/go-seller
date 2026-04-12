ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(24) NOT NULL DEFAULT 'delivery';

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);

UPDATE orders
SET fulfillment_type = COALESCE(NULLIF(fulfillment_type, ''), 'delivery')
WHERE fulfillment_type IS NULL OR fulfillment_type = '';
