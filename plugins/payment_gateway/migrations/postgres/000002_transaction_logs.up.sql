CREATE TABLE IF NOT EXISTS payment_gateway_transaction_logs (
	id UUID PRIMARY KEY,
	business_id UUID,
	provider_key VARCHAR(50) NOT NULL,
	direction VARCHAR(10) NOT NULL,
	event_type VARCHAR(60) NOT NULL,
	reference_id VARCHAR(120),
	provider_transaction_id VARCHAR(120),
	status VARCHAR(30),
	amount BIGINT,
	currency VARCHAR(8),
	request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
	response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
	error_message TEXT,
	ip_address VARCHAR(45),
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pgtxlogs_provider_key ON payment_gateway_transaction_logs(provider_key);
CREATE INDEX IF NOT EXISTS idx_pgtxlogs_direction ON payment_gateway_transaction_logs(direction);
CREATE INDEX IF NOT EXISTS idx_pgtxlogs_event_type ON payment_gateway_transaction_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_pgtxlogs_reference_id ON payment_gateway_transaction_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_pgtxlogs_business_id ON payment_gateway_transaction_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_pgtxlogs_created_at ON payment_gateway_transaction_logs(created_at DESC);
