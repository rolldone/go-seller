-- Add tax fields and price override flag to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS tax_type VARCHAR(16) DEFAULT 'exclude',
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS custom_tax BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS price_override_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_tax_type ON products(tax_type);
CREATE INDEX IF NOT EXISTS idx_products_tax_rate ON products(tax_rate);
CREATE INDEX IF NOT EXISTS idx_products_custom_tax ON products(custom_tax);
CREATE INDEX IF NOT EXISTS idx_products_price_override_enabled ON products(price_override_enabled);
