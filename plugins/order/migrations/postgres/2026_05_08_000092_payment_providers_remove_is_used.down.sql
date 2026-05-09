ALTER TABLE payment_providers
ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_payment_providers_is_used ON payment_providers(is_used);