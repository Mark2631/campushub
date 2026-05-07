-- Run this in Supabase SQL Editor if listing uploads, notifications, or verification inserts fail.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.verification_requests
  add column if not exists document_name text;

alter table public.verification_requests
  add column if not exists document_urls text[] not null default '{}';

alter table public.verification_requests
  add column if not exists updated_at timestamptz not null default now();

alter table public.businesses
  add column if not exists owner_id uuid references auth.users(id);

alter table public.businesses
  add column if not exists badge_type text not null default 'none';

alter table public.businesses
  add column if not exists verification_status text not null default 'unverified';

alter table public.listings enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Public can read active listings" on public.listings;
create policy "Public can read active listings"
on public.listings
for select
using (status = 'active' or auth.uid() = seller_id);

drop policy if exists "Users can insert own listings" on public.listings;
create policy "Users can insert own listings"
on public.listings
for insert
to authenticated
with check (auth.uid() = user_id and auth.uid() = seller_id);

drop policy if exists "Users can update own listings" on public.listings;
create policy "Users can update own listings"
on public.listings
for update
to authenticated
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);

drop policy if exists "Users can delete own listings" on public.listings;
create policy "Users can delete own listings"
on public.listings
for delete
to authenticated
using (auth.uid() = seller_id);

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
on public.notifications
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public can read listing media" on storage.objects;
create policy "Public can read listing media"
on storage.objects
for select
using (bucket_id = 'listing-media');

drop policy if exists "Authenticated users can upload listing media" on storage.objects;
create policy "Authenticated users can upload listing media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-media'
  and auth.uid() is not null
);

drop policy if exists "Authenticated users can update listing media" on storage.objects;
create policy "Authenticated users can update listing media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-media'
  and auth.uid() is not null
)
with check (
  bucket_id = 'listing-media'
  and auth.uid() is not null
);

drop policy if exists "Authenticated users can delete listing media" on storage.objects;
create policy "Authenticated users can delete listing media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-media'
  and auth.uid() is not null
);

drop policy if exists "Users can read profile media" on storage.objects;
create policy "Users can read profile media"
on storage.objects
for select
using (bucket_id = 'profile-media');

drop policy if exists "Users can upload profile media" on storage.objects;
create policy "Users can upload profile media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-media'
  and auth.uid() is not null
);

drop policy if exists "Users can update profile media" on storage.objects;
create policy "Users can update profile media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-media'
  and auth.uid() is not null
)
with check (
  bucket_id = 'profile-media'
  and auth.uid() is not null
);

drop policy if exists "Users can delete profile media" on storage.objects;
create policy "Users can delete profile media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and auth.uid() is not null
);
