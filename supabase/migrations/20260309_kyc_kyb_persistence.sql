ALTER TABLE exchange_accounts
  ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS kyc_provider_reference VARCHAR,
  ADD COLUMN IF NOT EXISTS kyb_status VARCHAR NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyb_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS kyb_provider_reference VARCHAR;
