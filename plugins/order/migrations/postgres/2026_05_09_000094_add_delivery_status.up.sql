-- Add delivery_status column to orders table
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(32) NOT NULL DEFAULT 'pending';

-- Expand shipment status column to support new values (ready_to_ship, in_transit, exception, returned)
ALTER TABLE order_shipments
    ALTER COLUMN status TYPE VARCHAR(32);

-- Back-fill delivery_status for existing orders based on current shipment state
UPDATE orders o
SET delivery_status = CASE
    -- fulfilled (all delivered)
    WHEN EXISTS (
        SELECT 1 FROM order_shipments s
        WHERE s.order_id = o.id AND LOWER(s.status) NOT IN ('cancelled', 'canceled')
    ) AND NOT EXISTS (
        SELECT 1 FROM order_shipments s
        WHERE s.order_id = o.id AND LOWER(s.status) NOT IN ('delivered', 'cancelled', 'canceled')
    ) THEN 'delivered'
    -- all shipped or better
    WHEN NOT EXISTS (
        SELECT 1 FROM order_shipments s
        WHERE s.order_id = o.id AND LOWER(s.status) NOT IN ('shipped', 'in_transit', 'delivered', 'cancelled', 'canceled')
    ) AND EXISTS (
        SELECT 1 FROM order_shipments s
        WHERE s.order_id = o.id AND LOWER(s.status) IN ('shipped', 'in_transit')
    ) THEN 'shipped'
    -- has active shipments (processing / ready_to_ship)
    WHEN EXISTS (
        SELECT 1 FROM order_shipments s
        WHERE s.order_id = o.id AND LOWER(s.status) NOT IN ('cancelled', 'canceled')
    ) THEN 'ready_to_ship'
    -- pickup orders
    WHEN LOWER(o.fulfillment_type) = 'pickup' THEN 'not_applicable'
    -- no shipments yet
    ELSE 'pending'
END
WHERE o.status NOT IN ('cancelled', 'canceled', 'draft', 'awaiting_quote', 'quote_ready');
