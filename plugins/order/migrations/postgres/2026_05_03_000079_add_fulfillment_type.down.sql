DROP INDEX IF EXISTS idx_orders_fulfillment_type;
ALTER TABLE orders
    DROP COLUMN IF EXISTS fulfillment_type;
