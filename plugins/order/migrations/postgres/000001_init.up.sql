-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Carts
CREATE TABLE IF NOT EXISTS carts (
	id UUID PRIMARY KEY,
	user_id UUID NOT NULL,
	business_id UUID,
	status VARCHAR(24) NOT NULL DEFAULT 'active',
	metadata JSONB,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,
	CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	CONSTRAINT fk_carts_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);

-- Keep one active cart per user per business context.
CREATE UNIQUE INDEX IF NOT EXISTS ux_carts_active_user_business
	ON carts (user_id, business_id)
	WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_business_id ON carts(business_id);
CREATE INDEX IF NOT EXISTS idx_carts_deleted_at ON carts(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS cart_items (
	id UUID PRIMARY KEY,
	cart_id UUID NOT NULL,
	product_id UUID,
	qty INT NOT NULL CHECK (qty > 0),
	unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
	total_price NUMERIC(15,2) NOT NULL DEFAULT 0,
	notes TEXT,
	metadata JSONB,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
	CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_cart_product ON cart_items(cart_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- 2. Wishlists
CREATE TABLE IF NOT EXISTS wishlists (
	id UUID PRIMARY KEY,
	user_id UUID NOT NULL,
	business_id UUID,
	name VARCHAR(100) NOT NULL DEFAULT 'default',
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	CONSTRAINT fk_wishlists_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wishlists_user_business_name ON wishlists(user_id, business_id, name);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_business_id ON wishlists(business_id);

CREATE TABLE IF NOT EXISTS wishlist_items (
	id UUID PRIMARY KEY,
	wishlist_id UUID NOT NULL,
	product_id UUID,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_wishlist_items_wishlist FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
	CONSTRAINT fk_wishlist_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wishlist_items_unique ON wishlist_items(wishlist_id, product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items(product_id);

-- 3. Orders (transactions core)
CREATE TABLE IF NOT EXISTS orders (
	id UUID PRIMARY KEY,
	order_number VARCHAR(50) NOT NULL UNIQUE,
	user_id UUID,
	business_id UUID,
	channel VARCHAR(24) NOT NULL DEFAULT 'web',
	created_by_admin_id UUID,
	status VARCHAR(24) NOT NULL DEFAULT 'pending',
	payment_status VARCHAR(24) NOT NULL DEFAULT 'unpaid',
	currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
	subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
	discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	shipping_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
	notes TEXT,
	metadata JSONB,
	placed_at TIMESTAMPTZ,
	paid_at TIMESTAMPTZ,
	cancelled_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
	CONSTRAINT fk_orders_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL,
	CONSTRAINT fk_orders_admin FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_created_by_admin_id ON orders(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
	id UUID PRIMARY KEY,
	order_id UUID NOT NULL,
	product_id UUID,
	product_name VARCHAR(255) NOT NULL,
	sku VARCHAR(50),
	qty INT NOT NULL CHECK (qty > 0),
	unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
	discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
	metadata JSONB,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
	CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 4. Payment + gateway histories
CREATE TABLE IF NOT EXISTS payments (
	id UUID PRIMARY KEY,
	order_id UUID NOT NULL,
	payment_method VARCHAR(50),
	gateway_name VARCHAR(50),
	gateway_transaction_id VARCHAR(120),
	status VARCHAR(24) NOT NULL DEFAULT 'pending',
	amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
	idempotency_key VARCHAR(120),
	request_payload JSONB,
	response_payload JSONB,
	paid_at TIMESTAMPTZ,
	failed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_transaction_id ON payments(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS payment_gateway_histories (
	id UUID PRIMARY KEY,
	payment_id UUID NOT NULL,
	event_type VARCHAR(80) NOT NULL,
	event_status VARCHAR(24),
	provider_reference VARCHAR(120),
	payload JSONB,
	signature_valid BOOLEAN,
	received_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_payment_gateway_histories_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_histories_payment_id ON payment_gateway_histories(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_histories_event_type ON payment_gateway_histories(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_histories_received_at ON payment_gateway_histories(received_at DESC);

-- 5. Financial transaction ledger per order/payment event
CREATE TABLE IF NOT EXISTS order_transactions (
	id UUID PRIMARY KEY,
	order_id UUID NOT NULL,
	payment_id UUID,
	transaction_type VARCHAR(40) NOT NULL,
	status VARCHAR(24) NOT NULL DEFAULT 'pending',
	amount NUMERIC(15,2) NOT NULL DEFAULT 0,
	currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
	reference VARCHAR(120),
	payload JSONB,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_order_transactions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
	CONSTRAINT fk_order_transactions_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_transactions_order_id ON order_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_order_transactions_payment_id ON order_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_order_transactions_type ON order_transactions(transaction_type);
