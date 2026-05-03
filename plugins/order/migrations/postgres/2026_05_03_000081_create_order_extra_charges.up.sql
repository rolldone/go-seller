-- 000013_create_order_extra_charges.up.sql
-- Stores custom additional charges attached to an order for reporting and accounting.

CREATE TABLE IF NOT EXISTS order_extra_charges (
    id                   UUID PRIMARY KEY,
    order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name                 VARCHAR(120) NOT NULL,
    amount               NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes                TEXT NOT NULL DEFAULT '',
    sort_order           INT NOT NULL DEFAULT 0,
    created_by_admin_id  UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_extra_charges_order_id ON order_extra_charges(order_id);
CREATE INDEX IF NOT EXISTS idx_order_extra_charges_admin_id ON order_extra_charges(created_by_admin_id);
