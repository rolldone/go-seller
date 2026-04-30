-- Create payouts table to store payout requests and their state
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
  status VARCHAR(32) NOT NULL,
  external_id VARCHAR(255),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_member_id
  ON payouts (member_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_business_id
  ON payouts (business_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_status
  ON payouts (status)
  WHERE deleted_at IS NULL;
