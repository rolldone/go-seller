-- Expand orders.status to support longer lifecycle values such as waiting_customer_confirmation
ALTER TABLE orders
    ALTER COLUMN status TYPE VARCHAR(255);