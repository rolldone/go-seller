-- Create table to store customers in the auth plugin.
CREATE TABLE IF NOT EXISTS customers (
	id UUID PRIMARY KEY,
	name VARCHAR(100) NOT NULL,
	email VARCHAR(255) UNIQUE NOT NULL,
	password TEXT,
	google_id TEXT,
	facebook_id TEXT,
	phone VARCHAR(20),
	notes TEXT,
	is_active BOOLEAN NOT NULL DEFAULT true,
	is_banned BOOLEAN NOT NULL DEFAULT false,
	banned_at TIMESTAMPTZ,
	banned_until TIMESTAMPTZ,
	ban_reason TEXT,
	banned_by UUID,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_is_banned ON customers(is_banned);