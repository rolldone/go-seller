CREATE TABLE IF NOT EXISTS product_variations (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    price NUMERIC(15,2) NOT NULL,
    compare_price NUMERIC(15,2),
    weight NUMERIC(10,3),
    dimensions_length NUMERIC(10,2),
    dimensions_width NUMERIC(10,2),
    dimensions_height NUMERIC(10,2),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_product_variations_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_variations_product ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_sku ON product_variations(sku);
CREATE INDEX IF NOT EXISTS idx_product_variations_is_active ON product_variations(is_active);
