-- Add confirmation columns to product_subscriptions
ALTER TABLE product_subscriptions
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_product_subscriptions_is_confirmed ON product_subscriptions(is_confirmed);
