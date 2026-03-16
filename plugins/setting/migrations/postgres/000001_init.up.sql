CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS settings (
	id UUID PRIMARY KEY,
	scope VARCHAR(24) NOT NULL DEFAULT 'global',
	key VARCHAR(120) NOT NULL,
	value JSONB NOT NULL DEFAULT 'null'::jsonb,
	description TEXT,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_settings_scope_key
	ON settings(scope, key);

CREATE INDEX IF NOT EXISTS idx_settings_scope ON settings(scope);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
