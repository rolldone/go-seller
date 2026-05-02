-- 000015_payment_add_method_id.up.sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method_id ON payments(payment_method_id);
