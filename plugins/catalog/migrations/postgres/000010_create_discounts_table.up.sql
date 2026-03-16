DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type_enum') THEN
        CREATE TYPE discount_type_enum AS ENUM ('percentage', 'fixed');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type discount_type_enum NOT NULL DEFAULT 'percentage',
    discount_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(15,2),
    start_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_at TIMESTAMPTZ,
    product_id UUID,
    product_min_qty INT,
    product_qty_limit INT,
    min_order_amount NUMERIC(15,2),
    per_user_only BOOLEAN DEFAULT FALSE,
    customer_id UUID,
    usage_limit INT,
    usage_limit_per_user INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_discounts_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discounts_product_id ON discounts(product_id);
CREATE INDEX IF NOT EXISTS idx_discounts_customer_id ON discounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON discounts(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_discounts_deleted_at ON discounts(deleted_at) WHERE deleted_at IS NOT NULL;
