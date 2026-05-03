CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label VARCHAR(80) NOT NULL DEFAULT '',
    receiver_name VARCHAR(120) NOT NULL DEFAULT '',
    phone_number VARCHAR(32) NOT NULL DEFAULT '',
    address_line_1 TEXT NOT NULL DEFAULT '',
    address_line_2 TEXT,
    subdistrict VARCHAR(120),
    district VARCHAR(120),
    city VARCHAR(120) NOT NULL DEFAULT '',
    province VARCHAR(120) NOT NULL DEFAULT '',
    postal_code VARCHAR(20) NOT NULL DEFAULT '',
    country VARCHAR(2) NOT NULL DEFAULT 'ID',
    notes TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_is_primary ON customer_addresses(is_primary);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_deleted_at ON customer_addresses(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_addresses_primary_active
    ON customer_addresses(customer_id)
    WHERE is_primary = TRUE AND deleted_at IS NULL;