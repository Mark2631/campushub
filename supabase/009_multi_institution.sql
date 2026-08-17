-- CampusTrader Multi-Institution Architecture Migration (009_multi_institution.sql)
-- Prepares the platform for Meru County tertiary institutions ecosystem expansion.

create extension if not exists pgcrypto;

-- 1. Create Institutions table
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  slug text unique not null,
  county text not null default 'Meru',
  logo text,
  cover text,
  status text not null default 'active' check (status in ('active', 'coming_soon', 'archived')),
  launch_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS for institutions
alter table public.institutions enable row level security;

create policy "Institutions are viewable by everyone"
  on public.institutions for select
  using (true);

-- Seed Meru County Tertiary Institutions
insert into public.institutions (name, short_name, slug, county, status)
values
  ('Meru University of Science and Technology', 'MUST', 'must', 'Meru', 'active'),
  ('The Meru National Polytechnic', 'Meru Poly', 'meru-poly', 'Meru', 'active'),
  ('Mukiria Technical Training Institute', 'Mukiria TTI', 'mukiria-tti', 'Meru', 'active'),
  ('Mitunguu Technical Training Institute', 'Mitunguu TTI', 'mitunguu-tti', 'Meru', 'active'),
  ('Karumo Technical Training Institute', 'Karumo TTI', 'karumo-tti', 'Meru', 'active'),
  ('Mount Kenya University Meru Campus', 'MKU Meru', 'mku-meru', 'Meru', 'active'),
  ('Kenya Methodist University Meru Centre', 'KeMU Meru', 'kemu-meru', 'Meru', 'active')
on conflict (slug) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  status = excluded.status;

-- 2. Add institution_id reference columns to core entities
alter table if exists public.profiles
  add column if not exists institution_id uuid references public.institutions(id);

alter table if exists public.listings
  add column if not exists institution_id uuid references public.institutions(id),
  add column if not exists is_sponsored boolean default false,
  add column if not exists is_featured boolean default false,
  add column if not exists boost_expires_at timestamptz;

alter table if exists public.item_requests
  add column if not exists institution_id uuid references public.institutions(id);

alter table if exists public.communities
  add column if not exists institution_id uuid references public.institutions(id);

alter table if exists public.businesses
  add column if not exists institution_id uuid references public.institutions(id);

-- 3. Populate default institution_id for existing records (defaulting to MUST)
do $$
declare
  must_id uuid;
begin
  select id into must_id from public.institutions where slug = 'must' limit 1;
  if must_id is not null then
    update public.profiles set institution_id = must_id where institution_id is null;
    update public.listings set institution_id = must_id where institution_id is null;
    update public.item_requests set institution_id = must_id where institution_id is null;
    update public.communities set institution_id = must_id where institution_id is null;
    if exists (select 1 from information_schema.tables where table_name = 'businesses') then
      update public.businesses set institution_id = must_id where institution_id is null;
    end if;
  end if;
end $$;

-- 4. Create indexes for performance optimization
create index if not exists idx_profiles_institution_id on public.profiles(institution_id);
create index if not exists idx_listings_institution_created on public.listings(institution_id, created_at desc);
create index if not exists idx_listings_institution_category on public.listings(institution_id, category);
create index if not exists idx_item_requests_institution on public.item_requests(institution_id, created_at desc);
create index if not exists idx_communities_institution on public.communities(institution_id);
