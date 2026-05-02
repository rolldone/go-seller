-- 000014_payment_methods.up.sql
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY,
    business_id UUID,
    provider_id UUID NOT NULL REFERENCES payment_providers(id),
    name VARCHAR(80) NOT NULL,
    code VARCHAR(80) NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    icon_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id ON payment_methods(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_provider_id ON payment_methods(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_category ON payment_methods(category);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);
