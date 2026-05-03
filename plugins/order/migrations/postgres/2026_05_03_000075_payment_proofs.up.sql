CREATE TABLE IF NOT EXISTS payment_proofs (
	id UUID PRIMARY KEY,
	payment_id UUID NOT NULL,
	order_id UUID NOT NULL,
	storage_bucket VARCHAR(120),
	storage_key TEXT NOT NULL,
	public_url TEXT,
	mime_type VARCHAR(80) NOT NULL,
	file_size BIGINT NOT NULL,
	checksum_sha256 VARCHAR(64),
	notes TEXT,
	status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
	uploaded_by_admin_id UUID,
	reviewed_by_admin_id UUID,
	reviewed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,
	CONSTRAINT fk_payment_proofs_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
	CONSTRAINT fk_payment_proofs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment_id ON payment_proofs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_created_at ON payment_proofs(created_at DESC);
