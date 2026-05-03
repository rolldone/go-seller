-- Create seller_withdrawals table
CREATE TABLE seller_withdrawals (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID NOT NULL,
    amount BIGINT NOT NULL, -- in cents
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, processed
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(100) NOT NULL,
    bank_account_name VARCHAR(200) NOT NULL,
    notes TEXT,
    admin_notes TEXT,
    reviewed_by_admin_id UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seller_withdrawals_seller_id ON seller_withdrawals(seller_id);
CREATE INDEX idx_seller_withdrawals_status ON seller_withdrawals(status);
CREATE INDEX idx_seller_withdrawals_created_at ON seller_withdrawals(created_at);
