-- write your UP migration here
-- Aktifkan ekstensi UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Khusus Admin (Pengelola Sistem)
CREATE TABLE IF NOT EXISTS admins (
	id UUID PRIMARY KEY,
	username VARCHAR(50) UNIQUE,
	email VARCHAR(255) UNIQUE,
	password_hash TEXT,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Khusus Users (Customer/Pelanggan)
CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY,
	full_name VARCHAR(100),
	email VARCHAR(255) UNIQUE,
	phone_number VARCHAR(20),
	is_active BOOLEAN DEFAULT true,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Sesi (JWT Refresh Token)
CREATE TABLE IF NOT EXISTS sessions (
	id UUID PRIMARY KEY,
	account_id UUID,
	account_type VARCHAR(20),
	token TEXT UNIQUE,
	expires_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
