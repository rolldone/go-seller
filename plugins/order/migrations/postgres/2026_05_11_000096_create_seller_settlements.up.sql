CREATE TABLE seller_settlements (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID NOT NULL,
    order_id UUID NOT NULL UNIQUE,
    gross_amount BIGINT NOT NULL,
    released_amount BIGINT NOT NULL DEFAULT 0,
    release_scope VARCHAR(50) NOT NULL DEFAULT 'full',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    source VARCHAR(50) NOT NULL DEFAULT 'settlement',
    reference_id VARCHAR(100),
    reference_type VARCHAR(50),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    admin_id UUID,
    admin_note TEXT,
    decided_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seller_settlements_seller_id ON seller_settlements(seller_id);
CREATE INDEX idx_seller_settlements_status ON seller_settlements(status);
CREATE INDEX idx_seller_settlements_created_at ON seller_settlements(created_at);
CREATE INDEX idx_seller_settlements_reference ON seller_settlements(reference_type, reference_id);