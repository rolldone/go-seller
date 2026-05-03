-- Add customer_id column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- (optional) keep this commented if you don't want automatic backfill
-- UPDATE orders SET customer_id = user_id WHERE customer_id IS NULL AND user_id IS NOT NULL;
