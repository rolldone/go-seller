ALTER TABLE orders
    DROP COLUMN IF EXISTS delivery_status;

ALTER TABLE order_shipments
    ALTER COLUMN status TYPE VARCHAR(24);
