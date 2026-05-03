-- write your DOWN migration here
-- Drop plugin auth tables (reverse of UP)
DROP INDEX IF EXISTS idx_sessions_account;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

-- Optionally remove uuid extension (commented out to avoid removing shared extension)
-- DROP EXTENSION IF EXISTS "uuid-ossp";
