CREATE TABLE IF NOT EXISTS order_discounts (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL,
    discount_id UUID NOT NULL,
    discount_name VARCHAR(255) NOT NULL,
    discount_type VARCHAR(24) NOT NULL,
    discount_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    priority INT NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_discounts_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_discounts_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_discounts_discount FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_order_discounts_order_item_id ON order_discounts(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_discounts_order_id ON order_discounts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_discounts_discount_id ON order_discounts(discount_id);
