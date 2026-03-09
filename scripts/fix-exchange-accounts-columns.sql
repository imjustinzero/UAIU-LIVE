-- Apply directly with: psql "$DATABASE_URL" -f scripts/fix-exchange-accounts-columns.sql
ALTER TABLE exchange_accounts
ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS kyc_provider_reference VARCHAR,
ADD COLUMN IF NOT EXISTS kyb_status VARCHAR NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS kyb_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS kyb_provider_reference VARCHAR;

-- Verify expected columns exist.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'exchange_accounts'
  AND column_name IN (
    'kyc_completed_at',
    'kyc_provider_reference',
    'kyb_status',
    'kyb_completed_at',
    'kyb_provider_reference'
  )
ORDER BY column_name;
