-- Remove customer_id column from orders
DROP INDEX IF EXISTS idx_orders_customer_id;
ALTER TABLE orders DROP COLUMN IF EXISTS customer_id;
