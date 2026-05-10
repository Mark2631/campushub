-- Run this in Supabase SQL Editor before deployment.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  email text,
  subject text,
  message text,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  business_id uuid,
  type text default 'student',
  request_type text,
  document_urls text[] default '{}',
  document_name text,
  status text default 'pending',
  admin_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table if exists public.listings add column if not exists user_id uuid;
alter table if exists public.listings add column if not exists seller_id uuid;
alter table if exists public.listings add column if not exists business_id uuid;
alter table if exists public.listings add column if not exists title text;
alter table if exists public.listings add column if not exists description text;
alter table if exists public.listings add column if not exists category text;
alter table if exists public.listings add column if not exists price numeric;
alter table if exists public.listings add column if not exists negotiable boolean default false;
alter table if exists public.listings add column if not exists condition text;
alter table if exists public.listings add column if not exists status text default 'active';
alter table if exists public.listings add column if not exists location text;
alter table if exists public.listings add column if not exists media_urls text[] default '{}';
alter table if exists public.listings add column if not exists video_url text;

alter table if exists public.verification_requests add column if not exists request_type text;
alter table if exists public.verification_requests add column if not exists document_urls text[] default '{}';
alter table if exists public.verification_requests add column if not exists document_name text;
alter table if exists public.verification_requests add column if not exists admin_note text;
alter table if exists public.verification_requests add column if not exists reviewed_at timestamptz;
alter table if exists public.verification_requests add column if not exists reviewed_by uuid references auth.users(id);

alter table if exists public.complaints add column if not exists email text;
alter table if exists public.complaints add column if not exists status text default 'open';

alter table if exists public.businesses add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.businesses add column if not exists user_id uuid references auth.users(id);
alter table if exists public.businesses add column if not exists badge_type text default 'none';
alter table if exists public.businesses add column if not exists verification_status text default 'unverified';

alter table if exists public.listings enable row level security;
alter table if exists public.admins enable row level security;
alter table if exists public.complaints enable row level security;
alter table if exists public.verification_requests enable row level security;
alter table if exists public.businesses enable row level security;

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

drop policy if exists "Anyone can read businesses" on public.businesses;
create policy "Anyone can read businesses"
on public.businesses
for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own businesses" on public.businesses;
create policy "Users can create own businesses"
on public.businesses
for insert
to authenticated
with check (owner_id = auth.uid() or user_id = auth.uid());

drop policy if exists "Users can update own businesses" on public.businesses;
create policy "Users can update own businesses"
on public.businesses
for update
to authenticated
using (owner_id = auth.uid() or user_id = auth.uid())
with check (owner_id = auth.uid() or user_id = auth.uid());

drop policy if exists "Users can read own admin row" on public.admins;
create policy "Users can read own admin row"
on public.admins
for select
to authenticated
using (email = auth.jwt() ->> 'email' or (auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

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
using (user_id = auth.uid() or email = auth.jwt() ->> 'email' or (auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

drop policy if exists "Admin can manage complaints" on public.complaints;
create policy "Admin can manage complaints"
on public.complaints
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

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
using (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

drop policy if exists "Admin can manage verification requests" on public.verification_requests;
create policy "Admin can manage verification requests"
on public.verification_requests
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

drop policy if exists "Public can view listing media" on storage.objects;
create policy "Public can view listing media"
on storage.objects
for select
to public
using (bucket_id = 'listing-media');

drop policy if exists "Authenticated users can upload listing media" on storage.objects;
create policy "Authenticated users can upload listing media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can update listing media" on storage.objects;
create policy "Authenticated users can update listing media"
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

drop policy if exists "Authenticated users can delete listing media" on storage.objects;
create policy "Authenticated users can delete listing media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into public.admins (email)
values ('mwanginewton107@gmail.com')
on conflict (email) do nothing;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists public.notifications enable row level security;

insert into storage.buckets (id, name, public)
values
  ('listing-media', 'listing-media', true),
  ('profile-media', 'profile-media', true),
  ('verification-media', 'verification-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Authenticated users can insert notifications" on public.notifications;
create policy "Authenticated users can insert notifications"
on public.notifications
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Public can read CampusTrader media" on storage.objects;
create policy "Public can read CampusTrader media"
on storage.objects
for select
to public
using (bucket_id in ('listing-media', 'profile-media', 'verification-media'));

drop policy if exists "Authenticated users can upload CampusTrader media" on storage.objects;
create policy "Authenticated users can upload CampusTrader media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('listing-media', 'profile-media', 'verification-media')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can update CampusTrader media" on storage.objects;
create policy "Authenticated users can update CampusTrader media"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('listing-media', 'profile-media', 'verification-media')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('listing-media', 'profile-media', 'verification-media')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can delete CampusTrader media" on storage.objects;
create policy "Authenticated users can delete CampusTrader media"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('listing-media', 'profile-media', 'verification-media')
  and (storage.foldername(name))[1] = auth.uid()::text
);
