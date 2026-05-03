-- Allow each discount to apply to multiple products without removing the existing product_id column.
CREATE TABLE IF NOT EXISTS discount_products (
    discount_id UUID NOT NULL,
    product_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (discount_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_discount_products_discount_id ON discount_products(discount_id);
CREATE INDEX IF NOT EXISTS idx_discount_products_product_id ON discount_products(product_id);

ALTER TABLE discount_products
    ADD CONSTRAINT fk_discount_products_discount FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE;
ALTER TABLE discount_products
    ADD CONSTRAINT fk_discount_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Seed existing single-product discounts into the new join table.
INSERT INTO discount_products (discount_id, product_id)
SELECT id, product_id FROM discounts WHERE product_id IS NOT NULL;
