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

insert into storage.buckets (id, name, public)
values
  ('listing-media', 'listing-media', true),
  ('profile-media', 'profile-media', true),
  ('verification-media', 'verification-media', true)
on conflict (id) do update set public = true;

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
alter table public.businesses enable row level security;

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

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notifications" on public.notifications;
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

drop policy if exists "Public can read listing media" on storage.objects;
drop policy if exists "Public can read CampusTrader media" on storage.objects;
create policy "Public can read CampusTrader media"
on storage.objects
for select
using (bucket_id in ('listing-media', 'profile-media', 'verification-media'));

drop policy if exists "Authenticated users can upload listing media" on storage.objects;
drop policy if exists "Authenticated users can upload CampusTrader media" on storage.objects;
create policy "Authenticated users can upload CampusTrader media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('listing-media', 'profile-media', 'verification-media')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can update listing media" on storage.objects;
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

drop policy if exists "Authenticated users can delete listing media" on storage.objects;
drop policy if exists "Authenticated users can delete CampusTrader media" on storage.objects;
create policy "Authenticated users can delete CampusTrader media"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('listing-media', 'profile-media', 'verification-media')
  and (storage.foldername(name))[1] = auth.uid()::text
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
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update profile media" on storage.objects;
create policy "Users can update profile media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete profile media" on storage.objects;
create policy "Users can delete profile media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
