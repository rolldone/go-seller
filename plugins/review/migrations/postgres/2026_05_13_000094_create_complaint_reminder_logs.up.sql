CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS complaint_reminder_logs (
	id UUID PRIMARY KEY,
	reminder_key VARCHAR(255) NOT NULL UNIQUE,
	complaint_case_id UUID NOT NULL,
	order_id UUID NOT NULL,
	order_number VARCHAR(50) NOT NULL,
	complaint_subject VARCHAR(200) NOT NULL,
	sender_type VARCHAR(24) NOT NULL,
	recipient_type VARCHAR(24) NOT NULL,
	recipient_ref_id UUID NOT NULL,
	recipient_label VARCHAR(200) NOT NULL,
	recipient_emails TEXT NOT NULL,
	expected_last_message_at TIMESTAMPTZ NOT NULL,
	due_at TIMESTAMPTZ NOT NULL,
	status VARCHAR(24) NOT NULL DEFAULT 'queued',
	attempt_count INTEGER NOT NULL DEFAULT 0,
	last_error TEXT,
	skip_reason TEXT,
	sent_at TIMESTAMPTZ,
	skipped_at TIMESTAMPTZ,
	next_run_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_complaint_reminder_logs_case FOREIGN KEY (complaint_case_id) REFERENCES complaint_cases(id) ON DELETE CASCADE,
	CONSTRAINT fk_complaint_reminder_logs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_complaint_reminder_logs_case_id ON complaint_reminder_logs(complaint_case_id);
CREATE INDEX IF NOT EXISTS idx_complaint_reminder_logs_status_due ON complaint_reminder_logs(status, due_at);
CREATE INDEX IF NOT EXISTS idx_complaint_reminder_logs_recipient_type ON complaint_reminder_logs(recipient_type);
CREATE INDEX IF NOT EXISTS idx_complaint_reminder_logs_created_at ON complaint_reminder_logs(created_at DESC);