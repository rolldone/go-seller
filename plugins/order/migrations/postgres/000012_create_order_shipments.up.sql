-- 000012_create_order_shipments.up.sql
-- Stores one shipping record per resi. An order can have multiple shipments.
-- Only physical/service items should be linked to a shipment; digital items are excluded.

CREATE TABLE IF NOT EXISTS order_shipments (
    id                  UUID PRIMARY KEY,
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier_name        VARCHAR(100) NOT NULL DEFAULT '',
    service_name        VARCHAR(100) NOT NULL DEFAULT '',
    tracking_number     VARCHAR(200) NOT NULL DEFAULT '',
    shipping_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
    estimated_delivery  VARCHAR(100) NOT NULL DEFAULT '',
    description         TEXT NOT NULL DEFAULT '',
    notes               TEXT NOT NULL DEFAULT '',
    status              VARCHAR(24) NOT NULL DEFAULT 'pending',
    -- status values: pending | processing | shipped | delivered | cancelled
    shipped_at          TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_status   ON order_shipments(status);

-- Maps order items to a specific shipment (allows partial shipments).
CREATE TABLE IF NOT EXISTS order_shipment_items (
    id          UUID PRIMARY KEY,
    shipment_id UUID NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    qty         INT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shipment_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_shipment_items_shipment_id  ON order_shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_order_shipment_items_order_item_id ON order_shipment_items(order_item_id);

-- Snapshot product_type on order_items so we can filter digital items without joining catalog.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS product_type VARCHAR(24) NOT NULL DEFAULT 'product';

-- Backfill product_type from catalog products for existing order_items.
UPDATE order_items oi
SET product_type = COALESCE(NULLIF(p.product_type::text, ''), 'product')
FROM products p
WHERE oi.product_id = p.id;
