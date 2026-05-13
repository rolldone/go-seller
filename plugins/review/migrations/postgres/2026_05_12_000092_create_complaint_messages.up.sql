CREATE TABLE IF NOT EXISTS complaint_messages (
	id UUID PRIMARY KEY,
	complaint_case_id UUID NOT NULL,
	sender_type VARCHAR(24) NOT NULL,
	sender_id UUID NOT NULL,
	sender_name VARCHAR(200) NOT NULL,
	body TEXT NOT NULL,
	is_internal BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_complaint_messages_case FOREIGN KEY (complaint_case_id) REFERENCES complaint_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_case_id ON complaint_messages(complaint_case_id);
CREATE INDEX IF NOT EXISTS idx_complaint_messages_created_at ON complaint_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_complaint_messages_sender_type ON complaint_messages(sender_type);