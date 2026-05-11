CREATE TABLE IF NOT EXISTS customer_wallet_withdrawals (
    id BIGSERIAL PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    requested_amount BIGINT NOT NULL,
    admin_fee BIGINT NOT NULL DEFAULT 0,
    other_fee BIGINT NOT NULL DEFAULT 0,
    net_amount BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(100) NOT NULL,
    bank_account_name VARCHAR(200) NOT NULL,
    notes TEXT,
    admin_notes TEXT,
    reviewed_by_admin_id UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    paid_by_admin_id UUID,
    paid_at TIMESTAMP WITH TIME ZONE,
    rejected_by_admin_id UUID,
    rejected_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_withdrawals_customer_id ON customer_wallet_withdrawals(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_withdrawals_status ON customer_wallet_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_withdrawals_created_at ON customer_wallet_withdrawals(created_at);