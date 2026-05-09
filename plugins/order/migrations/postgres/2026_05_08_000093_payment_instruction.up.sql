ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_instruction JSONB;