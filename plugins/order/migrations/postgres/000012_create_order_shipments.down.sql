-- 000012_create_order_shipments.down.sql
DROP TABLE IF EXISTS order_shipment_items;
DROP TABLE IF EXISTS order_shipments;
ALTER TABLE order_items DROP COLUMN IF EXISTS product_type;
