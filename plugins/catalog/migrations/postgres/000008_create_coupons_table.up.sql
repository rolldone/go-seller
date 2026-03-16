-- Capture promotional coupons scoped to date ranges, products, and users.
CREATE TABLE IF NOT EXISTS coupons (
        id UUID PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
        discount_value NUMERIC(15,2) NOT NULL,
        max_discount_amount NUMERIC(15,2),
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ,
        product_id UUID,
        product_min_qty INT,
        product_qty_limit INT,
        min_order_amount NUMERIC(15,2),
        per_user_only BOOLEAN NOT NULL DEFAULT false,
        customer_id UUID,
        usage_limit INT,
        usage_limit_per_user INT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coupons_product_id ON coupons(product_id);
CREATE INDEX IF NOT EXISTS idx_coupons_customer_id ON coupons(customer_id);
