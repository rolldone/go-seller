CREATE TABLE IF NOT EXISTS complaint_participants (
	id UUID PRIMARY KEY,
	complaint_case_id UUID NOT NULL,
	participant_type VARCHAR(24) NOT NULL,
	participant_id UUID NOT NULL,
	participant_name VARCHAR(200) NOT NULL,
	last_read_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_complaint_participants_case FOREIGN KEY (complaint_case_id) REFERENCES complaint_cases(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_complaint_participants_case_actor
	ON complaint_participants(complaint_case_id, participant_type, participant_id);
CREATE INDEX IF NOT EXISTS idx_complaint_participants_case_id ON complaint_participants(complaint_case_id);