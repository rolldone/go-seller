CREATE TABLE seller_withdrawal_audits (
    id BIGSERIAL PRIMARY KEY,
    withdrawal_id BIGINT NOT NULL,
    seller_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_type VARCHAR(50) NOT NULL,
    actor_id VARCHAR(100),
    status_from VARCHAR(50),
    status_to VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seller_withdrawal_audits_withdrawal_id ON seller_withdrawal_audits(withdrawal_id);
CREATE INDEX idx_seller_withdrawal_audits_seller_id ON seller_withdrawal_audits(seller_id);
CREATE INDEX idx_seller_withdrawal_audits_created_at ON seller_withdrawal_audits(created_at);
