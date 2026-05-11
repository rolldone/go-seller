CREATE TABLE IF NOT EXISTS customer_wallets (
    id BIGSERIAL PRIMARY KEY,
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    cash_balance BIGINT NOT NULL DEFAULT 0,
    promo_balance BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer_id ON customer_wallets(customer_id);

CREATE TABLE IF NOT EXISTS customer_wallet_mutations (
    id BIGSERIAL PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    balance_type VARCHAR(20) NOT NULL,
    mutation_type VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    source VARCHAR(100) NOT NULL,
    reference_id VARCHAR(100),
    reference_type VARCHAR(50),
    description TEXT,
    balance_after BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_mutations_customer_id ON customer_wallet_mutations(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_mutations_created_at ON customer_wallet_mutations(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_mutations_reference ON customer_wallet_mutations(reference_type, reference_id);