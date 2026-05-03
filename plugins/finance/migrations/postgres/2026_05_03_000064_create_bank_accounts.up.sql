-- Create bank_accounts table to store bank accounts for businesses (payout destinations)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bank VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_business_account_active
  ON bank_accounts (business_id, account_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_business_id
  ON bank_accounts (business_id)
  WHERE deleted_at IS NULL;
