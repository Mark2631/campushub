-- CampusTrader MVP support SQL. Run in the Supabase SQL editor.

alter table public.listings enable row level security;

drop policy if exists "Anyone can read active listings" on public.listings;
create policy "Anyone can read active listings"
on public.listings
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "Authenticated users can insert own listings" on public.listings;
create policy "Authenticated users can insert own listings"
on public.listings
for insert
to authenticated
with check (user_id = auth.uid() and seller_id = auth.uid());

drop policy if exists "Authenticated users can update own listings" on public.listings;
create policy "Authenticated users can update own listings"
on public.listings
for update
to authenticated
using (user_id = auth.uid() and seller_id = auth.uid())
with check (user_id = auth.uid() and seller_id = auth.uid());

drop policy if exists "Authenticated users can delete own listings" on public.listings;
create policy "Authenticated users can delete own listings"
on public.listings
for delete
to authenticated
using (user_id = auth.uid() and seller_id = auth.uid());

drop policy if exists "Admin can manage all listings" on public.listings;
create policy "Admin can manage all listings"
on public.listings
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  business_id uuid nullable references public.businesses(id),
  type text check (type in ('student', 'national_id', 'business')),
  request_type text,
  document_urls text[] default '{}',
  document_name text,
  status text default 'pending',
  admin_note text nullable,
  created_at timestamptz default now(),
  reviewed_at timestamptz nullable,
  reviewed_by uuid nullable references auth.users(id)
);

alter table public.verification_requests enable row level security;

drop policy if exists "Users can create verification requests" on public.verification_requests;
create policy "Users can create verification requests"
on public.verification_requests
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can read own verification requests" on public.verification_requests;
create policy "Users can read own verification requests"
on public.verification_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admin can manage verification requests" on public.verification_requests;
create policy "Admin can manage verification requests"
on public.verification_requests
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid nullable references auth.users(id),
  email text,
  subject text,
  message text,
  status text default 'open',
  created_at timestamptz default now()
);

alter table public.complaints enable row level security;

drop policy if exists "Users can create complaints" on public.complaints;
create policy "Users can create complaints"
on public.complaints
for insert
to anon, authenticated
with check (true);

drop policy if exists "Users can read own complaints" on public.complaints;
create policy "Users can read own complaints"
on public.complaints
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admin can manage complaints" on public.complaints;
create policy "Admin can manage complaints"
on public.complaints
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

drop policy if exists "Admin can manage reports" on public.reports;
create policy "Admin can manage reports"
on public.reports
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

drop policy if exists "Admin can manage businesses" on public.businesses;
create policy "Admin can manage businesses"
on public.businesses
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

drop policy if exists "Admin can read profiles" on public.profiles;
create policy "Admin can read profiles"
on public.profiles
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

insert into public.admins (email)
values ('mwanginewton107@gmail.com')
on conflict (email) do nothing;

drop policy if exists "Admins can read admins table" on public.admins;
alter table public.admins enable row level security;
create policy "Admins can read admins table"
on public.admins
for select
to authenticated
using (email = auth.jwt() ->> 'email' or (auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

drop policy if exists "Authenticated users can read own admin row" on public.admins;
create policy "Authenticated users can read own admin row"
on public.admins
for select
to authenticated
using (email = auth.jwt() ->> 'email');

drop policy if exists "Authenticated users can upload own listing media" on storage.objects;
create policy "Authenticated users can upload own listing media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public can view listing media" on storage.objects;
create policy "Public can view listing media"
on storage.objects
for select
to public
using (bucket_id = 'listing-media');

drop policy if exists "Authenticated users can update own listing media" on storage.objects;
create policy "Authenticated users can update own listing media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'listing-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can delete own listing media" on storage.objects;
create policy "Authenticated users can delete own listing media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
