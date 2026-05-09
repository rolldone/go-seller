-- Restore legacy payment_methods columns if this migration is rolled back.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS code VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS icon_url VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_category ON payment_methods(category);
