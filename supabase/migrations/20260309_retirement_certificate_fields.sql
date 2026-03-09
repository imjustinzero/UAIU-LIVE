alter table if exists exchange_trades
  add column if not exists retirement_status text,
  add column if not exists retirement_certificate_id text,
  add column if not exists retirement_certificate_url text,
  add column if not exists retirement_certificate_generated_at timestamptz,
  add column if not exists retirement_purpose text;

create index if not exists exchange_trades_retirement_certificate_id_idx
  on exchange_trades (retirement_certificate_id);
