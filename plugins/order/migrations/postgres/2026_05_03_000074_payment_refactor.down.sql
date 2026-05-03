DROP INDEX IF EXISTS idx_payment_gateway_histories_idempotency_key;
DROP INDEX IF EXISTS idx_payment_gateway_histories_occurred_at;

ALTER TABLE payment_gateway_histories
	DROP COLUMN IF EXISTS occurred_at,
	DROP COLUMN IF EXISTS event_idempotency_key,
	DROP COLUMN IF EXISTS actor_id,
	DROP COLUMN IF EXISTS actor_type,
	DROP COLUMN IF EXISTS provider_key;

DROP INDEX IF EXISTS idx_payments_proof_status;
DROP INDEX IF EXISTS idx_payments_order_status;
DROP INDEX IF EXISTS idx_payments_provider_transaction_id;
DROP INDEX IF EXISTS idx_payments_provider_key;
DROP INDEX IF EXISTS idx_payments_provider_id;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_provider;

ALTER TABLE payments
	DROP COLUMN IF EXISTS metadata,
	DROP COLUMN IF EXISTS reconciled_at,
	DROP COLUMN IF EXISTS expired_at,
	DROP COLUMN IF EXISTS net_amount,
	DROP COLUMN IF EXISTS fee_amount,
	DROP COLUMN IF EXISTS proof_status,
	DROP COLUMN IF EXISTS external_reference,
	DROP COLUMN IF EXISTS provider_transaction_id,
	DROP COLUMN IF EXISTS provider_key,
	DROP COLUMN IF EXISTS provider_id;
