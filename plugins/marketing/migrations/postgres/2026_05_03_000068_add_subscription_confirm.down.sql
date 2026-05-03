DROP INDEX IF EXISTS idx_product_subscriptions_is_confirmed;
ALTER TABLE product_subscriptions
  DROP COLUMN IF EXISTS is_confirmed,
  DROP COLUMN IF EXISTS confirmed_at;
