-- UAIU Navigator Supabase schema
create table if not exists navigator_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  project_name text,
  project_type text,
  country text,
  hectares numeric,
  estimated_tonnes numeric,
  land_ownership text,
  methodology_selected text,
  registration_status text default 'intake',
  readiness_score integer default 0 check (readiness_score between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists navigator_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references navigator_projects(id) on delete cascade,
  document_type text,
  document_name text,
  status text check (status in ('required','uploaded','approved','missing')) default 'required',
  notes text,
  created_at timestamptz default now()
);

create table if not exists navigator_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references navigator_projects(id) on delete cascade,
  category text,
  item text,
  completed boolean default false,
  required boolean default true,
  created_at timestamptz default now()
);

create table if not exists navigator_vvb_contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  website text,
  email text,
  specializations text[],
  regions text[],
  active boolean default true
);

insert into navigator_vvb_contacts (name, website, email, specializations, regions, active) values
('SustainCERT','https://sustain-cert.com','info@sustain-cert.com',array['AFOLU','REDD+','ARR','IFM'],array['Global'],true),
('Bureau Veritas','https://bureauveritas.com','carbon@bureauveritas.com',array['All scopes'],array['Global'],true),
('BSI Group','https://bsigroup.com','carbon@bsigroup.com',array['AFOLU','Energy'],array['Global'],true),
('SGS','https://sgs.com','carbon@sgs.com',array['All scopes'],array['Global'],true),
('SCS Global Services','https://scsglobalservices.com','carbon@scsglobalservices.com',array['AFOLU','REDD+','Blue Carbon'],array['Americas','Asia'],true),
('Earthood','https://earthood.in','info@earthood.in',array['AFOLU','REDD+','ARR'],array['Asia','Africa'],true),
('AENOR','https://aenor.com','carbono@aenor.com',array['Energy','AFOLU'],array['Europe','Latin America'],true)
on conflict do nothing;

alter table navigator_projects enable row level security;
alter table navigator_documents enable row level security;
alter table navigator_checklist_items enable row level security;

create policy "users_manage_own_projects" on navigator_projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_manage_own_documents" on navigator_documents for all using (project_id in (select id from navigator_projects where user_id = auth.uid())) with check (project_id in (select id from navigator_projects where user_id = auth.uid()));
create policy "users_manage_own_checklist" on navigator_checklist_items for all using (project_id in (select id from navigator_projects where user_id = auth.uid())) with check (project_id in (select id from navigator_projects where user_id = auth.uid()));
create policy "public_read_vvb" on navigator_vvb_contacts for select using (true);
