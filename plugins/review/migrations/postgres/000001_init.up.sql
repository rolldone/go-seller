CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customer_reviews (
	id UUID PRIMARY KEY,
	order_id UUID NOT NULL,
	order_item_id UUID NOT NULL,
	product_id UUID NOT NULL,
	customer_id UUID NOT NULL,
	rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
	review_text TEXT,
	question_text TEXT,
	seller_reply TEXT,
	seller_reply_at TIMESTAMPTZ,
	status VARCHAR(24) NOT NULL DEFAULT 'published',
	is_visible BOOLEAN NOT NULL DEFAULT TRUE,
	metadata JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_customer_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
	CONSTRAINT fk_customer_reviews_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
	CONSTRAINT fk_customer_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
	CONSTRAINT fk_customer_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_reviews_order_item_customer
	ON customer_reviews(order_item_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_product_id ON customer_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_customer_id ON customer_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_order_id ON customer_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_status_visible_created
	ON customer_reviews(status, is_visible, created_at DESC);
