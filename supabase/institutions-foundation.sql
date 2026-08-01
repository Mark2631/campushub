-- CampusTrader multi-institution foundation.
-- Run after the existing launch polish scripts.

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  slug text not null unique,
  county text not null default 'Meru',
  logo text,
  cover text,
  status text not null default 'disabled' check (status in ('active', 'coming_soon', 'disabled')),
  launch_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'institutions'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if constraint_name is not null then
    execute format('alter table public.institutions drop constraint if exists %I', constraint_name);
  end if;
end $$;

alter table public.institutions
  add constraint institutions_status_check
  check (status in ('active', 'coming_soon', 'disabled'));

insert into public.institutions (name, short_name, slug, county, status)
values
  ('Meru University of Science and Technology', 'MUST', 'must', 'Meru', 'active'),
  ('The Meru National Polytechnic', 'Meru Polytechnic', 'meru-national-polytechnic', 'Meru', 'coming_soon'),
  ('Mukiria Technical Training Institute', 'Mukiria TTI', 'mukiria-tti', 'Meru', 'coming_soon'),
  ('Mitunguu Technical Training Institute', 'Mitunguu TTI', 'mitunguu-tti', 'Meru', 'coming_soon'),
  ('Karumo Technical Training Institute', 'Karumo TTI', 'karumo-tti', 'Meru', 'coming_soon'),
  ('Mount Kenya University Meru Campus', 'MKU Meru', 'mku-meru', 'Meru', 'coming_soon'),
  ('Kenya Methodist University Meru Centre', 'KeMU Meru', 'kemu-meru', 'Meru', 'coming_soon')
on conflict (slug) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  county = excluded.county,
  status = excluded.status;

alter table if exists public.profiles add column if not exists institution_id uuid references public.institutions(id);
alter table if exists public.listings add column if not exists institution_id uuid references public.institutions(id);
alter table if exists public.item_requests add column if not exists institution_id uuid references public.institutions(id);
alter table if exists public.communities add column if not exists institution_id uuid references public.institutions(id);
alter table if exists public.businesses add column if not exists institution_id uuid references public.institutions(id);

with must as (select id from public.institutions where slug = 'must')
update public.profiles
set institution_id = must.id
from must
where public.profiles.institution_id is null
  and coalesce(public.profiles.campus, 'MUST') = 'MUST';

with must as (select id from public.institutions where slug = 'must')
update public.listings
set institution_id = must.id
from must
where public.listings.institution_id is null
  and coalesce(public.listings.campus, 'MUST') = 'MUST';

with must as (select id from public.institutions where slug = 'must')
update public.item_requests
set institution_id = must.id
from must
where public.item_requests.institution_id is null
  and coalesce(public.item_requests.campus, 'MUST') = 'MUST';

with must as (select id from public.institutions where slug = 'must')
update public.communities
set institution_id = must.id
from must
where public.communities.institution_id is null
  and coalesce(public.communities.campus, 'MUST') = 'MUST';

with must as (select id from public.institutions where slug = 'must')
update public.businesses
set institution_id = must.id
from must
where public.businesses.institution_id is null
  and coalesce(public.businesses.campus, 'MUST') = 'MUST';

create index if not exists institutions_status_idx on public.institutions(status);
create index if not exists profiles_institution_id_idx on public.profiles(institution_id);
create index if not exists listings_institution_id_status_idx on public.listings(institution_id, status, created_at desc);
create index if not exists item_requests_institution_id_idx on public.item_requests(institution_id, created_at desc);
create index if not exists communities_institution_id_idx on public.communities(institution_id, category);
create index if not exists businesses_institution_id_idx on public.businesses(institution_id, verification_status);

alter table public.institutions enable row level security;

drop policy if exists "Anyone can read launch institutions" on public.institutions;
create policy "Anyone can read launch institutions"
on public.institutions
for select
using (status in ('active', 'coming_soon'));
