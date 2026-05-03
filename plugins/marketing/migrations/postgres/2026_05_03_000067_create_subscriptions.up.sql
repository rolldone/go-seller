-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Product / Business Subscriptions
CREATE TABLE IF NOT EXISTS product_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL,
    product_id UUID,
    customer_id UUID,
    email VARCHAR(255) NOT NULL,
    consent BOOLEAN NOT NULL DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_product_subscriptions_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_subscriptions_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_product_subscriptions_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Unique active subscription per email/business/product (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_subscriptions_business_product_email
    ON product_subscriptions(business_id, product_id, LOWER(email))
    WHERE unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_subscriptions_customer ON product_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_subscriptions_business ON product_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_product_subscriptions_product ON product_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_subscriptions_subscribed_at ON product_subscriptions(subscribed_at);
