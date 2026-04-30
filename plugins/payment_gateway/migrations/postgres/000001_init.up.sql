CREATE TABLE IF NOT EXISTS payment_gateway_providers (
	id UUID PRIMARY KEY,
	business_id UUID,
	name VARCHAR(80) NOT NULL,
	provider_key VARCHAR(50) NOT NULL,
	is_active BOOLEAN NOT NULL DEFAULT false,
	is_used BOOLEAN NOT NULL DEFAULT false,
	config JSONB NOT NULL DEFAULT '{}'::jsonb,
	credentials_encrypted TEXT,
	created_by_admin_id UUID,
	updated_by_admin_id UUID,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_providers_business_id ON payment_gateway_providers(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_providers_provider_key ON payment_gateway_providers(provider_key);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_providers_is_active ON payment_gateway_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_providers_is_used ON payment_gateway_providers(is_used);
