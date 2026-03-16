DROP INDEX IF EXISTS idx_order_transactions_type;
DROP INDEX IF EXISTS idx_order_transactions_payment_id;
DROP INDEX IF EXISTS idx_order_transactions_order_id;
DROP TABLE IF EXISTS order_transactions;

DROP INDEX IF EXISTS idx_payment_gateway_histories_received_at;
DROP INDEX IF EXISTS idx_payment_gateway_histories_event_type;
DROP INDEX IF EXISTS idx_payment_gateway_histories_payment_id;
DROP TABLE IF EXISTS payment_gateway_histories;

DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payments_gateway_transaction_id;
DROP INDEX IF EXISTS idx_payments_order_id;
DROP INDEX IF EXISTS ux_payments_idempotency_key;
DROP TABLE IF EXISTS payments;

DROP INDEX IF EXISTS idx_order_items_product_id;
DROP INDEX IF EXISTS idx_order_items_order_id;
DROP TABLE IF EXISTS order_items;

DROP INDEX IF EXISTS idx_orders_created_at;
DROP INDEX IF EXISTS idx_orders_created_by_admin_id;
DROP INDEX IF EXISTS idx_orders_channel;
DROP INDEX IF EXISTS idx_orders_payment_status;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_business_id;
DROP INDEX IF EXISTS idx_orders_user_id;
DROP TABLE IF EXISTS orders;

DROP INDEX IF EXISTS idx_wishlist_items_product_id;
DROP INDEX IF EXISTS idx_wishlist_items_wishlist_id;
DROP INDEX IF EXISTS ux_wishlist_items_unique;
DROP TABLE IF EXISTS wishlist_items;

DROP INDEX IF EXISTS idx_wishlists_business_id;
DROP INDEX IF EXISTS idx_wishlists_user_id;
DROP INDEX IF EXISTS ux_wishlists_user_business_name;
DROP TABLE IF EXISTS wishlists;

DROP INDEX IF EXISTS idx_cart_items_product_id;
DROP INDEX IF EXISTS idx_cart_items_cart_id;
DROP INDEX IF EXISTS ux_cart_items_cart_product;
DROP TABLE IF EXISTS cart_items;

DROP INDEX IF EXISTS idx_carts_deleted_at;
DROP INDEX IF EXISTS idx_carts_business_id;
DROP INDEX IF EXISTS idx_carts_user_id;
DROP INDEX IF EXISTS ux_carts_active_user_business;
DROP TABLE IF EXISTS carts;
