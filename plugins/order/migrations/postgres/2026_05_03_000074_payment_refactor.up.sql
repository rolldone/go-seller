ALTER TABLE payments
	ADD COLUMN IF NOT EXISTS provider_id UUID,
	ADD COLUMN IF NOT EXISTS provider_key VARCHAR(50),
	ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(120),
	ADD COLUMN IF NOT EXISTS external_reference VARCHAR(120),
	ADD COLUMN IF NOT EXISTS proof_status VARCHAR(20) NOT NULL DEFAULT 'none',
	ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS net_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE payments
	ADD CONSTRAINT fk_payments_provider
	FOREIGN KEY (provider_id)
	REFERENCES payment_providers(id)
	ON DELETE SET NULL;

UPDATE payments
SET provider_transaction_id = gateway_transaction_id
WHERE provider_transaction_id IS NULL AND gateway_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_key ON payments(provider_key);
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id ON payments(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_proof_status ON payments(proof_status);

ALTER TABLE payment_gateway_histories
	ADD COLUMN IF NOT EXISTS provider_key VARCHAR(50),
	ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20),
	ADD COLUMN IF NOT EXISTS actor_id VARCHAR(64),
	ADD COLUMN IF NOT EXISTS event_idempotency_key VARCHAR(120),
	ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_gateway_histories_occurred_at
	ON payment_gateway_histories(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_histories_idempotency_key
	ON payment_gateway_histories(event_idempotency_key);
