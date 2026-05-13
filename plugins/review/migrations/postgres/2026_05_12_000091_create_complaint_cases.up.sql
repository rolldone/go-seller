CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS complaint_cases (
	id UUID PRIMARY KEY,
	order_id UUID NOT NULL,
	customer_id UUID NOT NULL,
	subject VARCHAR(200) NOT NULL,
	description TEXT NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'open',
	last_message_at TIMESTAMPTZ,
	resolved_at TIMESTAMPTZ,
	closed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_complaint_cases_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
	CONSTRAINT fk_complaint_cases_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_complaint_cases_order_id ON complaint_cases(order_id);
CREATE INDEX IF NOT EXISTS idx_complaint_cases_customer_id ON complaint_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaint_cases_status_created ON complaint_cases(status, created_at DESC);