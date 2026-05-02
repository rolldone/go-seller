-- Create seller_balances table
CREATE TABLE seller_balances (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID NOT NULL UNIQUE,
    balance BIGINT NOT NULL DEFAULT 0, -- in cents/smallest currency unit
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seller_balances_seller_id ON seller_balances(seller_id);

-- Create seller_balance_mutations table (audit trail)
CREATE TABLE seller_balance_mutations (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID NOT NULL,
    mutation_type VARCHAR(50) NOT NULL, -- 'credit' or 'debet'
    amount BIGINT NOT NULL, -- always positive, sign determined by mutation_type
    source VARCHAR(100) NOT NULL, -- 'order', 'withdraw', 'fee', 'admin_adjust', etc.
    reference_id VARCHAR(100), -- ID dari order, withdrawal, atau transaksi lain
    reference_type VARCHAR(50), -- 'order', 'withdrawal', 'fee', etc.
    description TEXT,
    balance_after BIGINT NOT NULL, -- saldo setelah mutasi ini
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seller_balance_mutations_seller_id ON seller_balance_mutations(seller_id);
CREATE INDEX idx_seller_balance_mutations_created_at ON seller_balance_mutations(created_at);
CREATE INDEX idx_seller_balance_mutations_reference ON seller_balance_mutations(reference_type, reference_id);
