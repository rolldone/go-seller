CREATE TABLE IF NOT EXISTS variation_attributes (
    id UUID PRIMARY KEY,
    product_variation_id UUID NOT NULL,
    attribute_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variation_attributes_variation
        FOREIGN KEY (product_variation_id) REFERENCES product_variations(id) ON DELETE CASCADE,
    CONSTRAINT fk_variation_attributes_attribute
        FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON DELETE CASCADE,
    CONSTRAINT uq_variation_attributes_combo UNIQUE (product_variation_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_variation_attributes_variation ON variation_attributes(product_variation_id);
CREATE INDEX IF NOT EXISTS idx_variation_attributes_attribute ON variation_attributes(attribute_id);
