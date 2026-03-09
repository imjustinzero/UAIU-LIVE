ALTER TABLE exchange_accounts
  ADD COLUMN IF NOT EXISTS kyc_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_provider_reference text,
  ADD COLUMN IF NOT EXISTS kyb_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyb_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_provider_reference text;

