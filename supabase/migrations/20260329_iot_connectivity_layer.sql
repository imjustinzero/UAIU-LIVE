create table if not exists iot_raw_payloads (
  id uuid primary key default gen_random_uuid(),
  device_id varchar,
  source varchar not null,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamp not null default now(),
  processed boolean not null default false,
  reading_ids jsonb not null default '[]'::jsonb
);

create table if not exists device_certifications (
  id uuid primary key default gen_random_uuid(),
  manufacturer varchar not null,
  device_model varchar not null,
  firmware_version varchar,
  test_results jsonb not null default '{}'::jsonb,
  certified_at timestamp,
  certification_level varchar not null default 'compatible',
  badge_url varchar,
  created_at timestamp not null default now()
);
