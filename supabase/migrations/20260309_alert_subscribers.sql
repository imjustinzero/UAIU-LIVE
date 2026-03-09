create table if not exists alert_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  organization text not null,
  sector text not null,
  frameworks text[] not null default '{}',
  alert_timing text[] not null default '{}',
  source text,
  confirmed boolean not null default false,
  confirm_token text not null unique,
  unsubscribe_token text not null unique,
  subscribed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists alert_subscribers_email_idx on alert_subscribers (lower(email));
create index if not exists alert_subscribers_sector_idx on alert_subscribers (sector);
create index if not exists alert_subscribers_confirmed_idx on alert_subscribers (confirmed);

alter table alert_subscribers enable row level security;

create policy if not exists "service_role_full_access_alert_subscribers"
on alert_subscribers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
