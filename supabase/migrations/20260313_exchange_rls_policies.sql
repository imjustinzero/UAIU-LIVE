-- Enable RLS on exchange tables and scope authenticated users to their own records.

alter table if exists exchange_accounts enable row level security;
alter table if exists exchange_trades enable row level security;
alter table if exists exchange_rfqs enable row level security;
alter table if exists exchange_credit_listings enable row level security;

create policy if not exists "exchange_accounts_select_own"
on exchange_accounts
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_accounts_update_own"
on exchange_accounts
for update
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'))
with check (lower(email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_accounts_insert_own"
on exchange_accounts
for insert
to authenticated
with check (lower(email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_trades_select_own"
on exchange_trades
for select
to authenticated
using (lower(account_email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_trades_insert_own"
on exchange_trades
for insert
to authenticated
with check (lower(account_email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_rfqs_select_own"
on exchange_rfqs
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_rfqs_insert_own"
on exchange_rfqs
for insert
to authenticated
with check (lower(email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_credit_listings_select_own"
on exchange_credit_listings
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy if not exists "exchange_credit_listings_insert_own"
on exchange_credit_listings
for insert
to authenticated
with check (lower(email) = lower(auth.jwt() ->> 'email'));
