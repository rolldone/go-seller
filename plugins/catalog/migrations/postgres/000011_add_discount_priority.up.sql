ALTER TABLE discounts
    ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_discounts_priority ON discounts(priority DESC);
