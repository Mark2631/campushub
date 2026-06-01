-- CampusTrader final launch polish
-- Run this once in the Supabase SQL Editor after the earlier core/community scripts.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table if exists public.profiles
  add column if not exists email_verified boolean not null default false,
  add column if not exists campus text not null default 'MUST';

alter table if exists public.listings
  add column if not exists seller_id uuid,
  add column if not exists business_id uuid,
  add column if not exists campus text not null default 'MUST',
  add column if not exists status text not null default 'active';

alter table if exists public.businesses
  add column if not exists owner_id uuid references auth.users(id),
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists status text not null default 'active',
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists badge_type text default 'none';

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.listings') is not null then
    for constraint_name in
      select conname
      from pg_constraint
      where conrelid = 'public.listings'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%status%'
    loop
      execute format('alter table public.listings drop constraint if exists %I', constraint_name);
    end loop;

    alter table public.listings
      add constraint listings_status_check
      check (status in ('active', 'sold', 'hidden', 'reported', 'pending_payment'));
  end if;
end $$;

alter table if exists public.communities
  add column if not exists campus text not null default 'MUST',
  add column if not exists cover_url text,
  add column if not exists posting_mode text not null default 'everyone';

alter table if exists public.item_requests
  add column if not exists campus text not null default 'MUST';

alter table if exists public.conversations
  add column if not exists hidden_for uuid[] not null default '{}';

drop view if exists public.marketplace_profiles;
create view public.marketplace_profiles as
select
  id,
  full_name,
  avatar_url,
  phone_number,
  badge_type,
  verification_status,
  role,
  email_verified,
  created_at
from public.profiles
where coalesce(account_status, 'active') = 'active';

drop view if exists public.marketplace_businesses;
create view public.marketplace_businesses as
select
  id,
  business_name,
  verification_status,
  badge_type
from public.businesses
where coalesce(status, 'active') = 'active';

grant select on public.marketplace_profiles to anon, authenticated;
grant select on public.marketplace_businesses to anon, authenticated;

create table if not exists public.business_post_payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ksh integer not null default 60 check (amount_ksh = 60),
  till_number text not null default '6362615',
  account_name text not null default 'Newton Mwangi',
  reference text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  admin_note text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id)
);

alter table public.business_post_payments enable row level security;

drop policy if exists "Users can create own business payment review" on public.business_post_payments;
create policy "Users can create own business payment review"
on public.business_post_payments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and amount_ksh = 60
  and till_number = '6362615'
  and account_name = 'Newton Mwangi'
  and status = 'pending'
  and exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.seller_id = auth.uid()
      and l.business_id = business_id
      and l.status = 'pending_payment'
  )
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and (b.owner_id = auth.uid() or b.user_id = auth.uid())
  )
);

drop policy if exists "Users can view own business payment reviews" on public.business_post_payments;
create policy "Users can view own business payment reviews"
on public.business_post_payments
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can update own pending business payment reference" on public.business_post_payments;
create policy "Users can update own pending business payment reference"
on public.business_post_payments
for update
to authenticated
using (auth.uid() = user_id and status = 'pending')
with check (
  auth.uid() = user_id
  and status = 'pending'
  and amount_ksh = 60
  and till_number = '6362615'
  and account_name = 'Newton Mwangi'
);

drop policy if exists "Admins can manage business payment reviews" on public.business_post_payments;
create policy "Admins can manage business payment reviews"
on public.business_post_payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.business_post_payments to authenticated;

drop policy if exists "Admins can insert admins" on public.admins;
create policy "Admins can insert admins"
on public.admins
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update admins" on public.admins;
create policy "Admins can update admins"
on public.admins
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can read admins table" on public.admins;
create policy "Admins can read admins table"
on public.admins
for select
to authenticated
using (email = auth.jwt() ->> 'email' or public.is_admin());

drop policy if exists "Conversation participants can hide conversations" on public.conversations;
create policy "Conversation participants can hide conversations"
on public.conversations
for update
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id)
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Users can create posts in open communities" on public.community_posts;
create policy "Users can create posts in open communities"
on public.community_posts
for insert
to authenticated
with check (
  auth.uid() = author_id
  and exists (
    select 1
    from public.communities c
    where c.id = community_id
      and c.status = 'active'
      and (c.posting_mode = 'everyone' or public.is_admin())
  )
);

drop policy if exists "Admins can moderate community posts" on public.community_posts;
create policy "Admins can moderate community posts"
on public.community_posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.admin_actions') is not null then
    for constraint_name in
      select conname
      from pg_constraint
      where conrelid = 'public.admin_actions'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%action_type%'
    loop
      execute format('alter table public.admin_actions drop constraint if exists %I', constraint_name);
    end loop;

    alter table public.admin_actions
      add constraint admin_actions_action_type_check
      check (action_type in (
        'user_suspend',
        'user_unblock',
        'user_verify',
        'user_warn',
        'business_approve',
        'business_reject',
        'business_revoke',
        'business_suspend',
        'business_terminate',
        'listing_hide',
        'listing_restore',
        'listing_delete',
        'verification_approve',
        'verification_reject',
        'verification_revoke',
        'report_resolve',
        'user_ban',
        'business_post_payment_approve',
        'business_post_payment_reject'
      ));
  end if;
end $$;

create index if not exists idx_business_post_payments_status on public.business_post_payments(status, created_at desc);
create index if not exists idx_business_post_payments_user on public.business_post_payments(user_id, created_at desc);
create index if not exists idx_conversations_hidden_for on public.conversations using gin(hidden_for);

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload community media" on storage.objects;
create policy "Authenticated users can upload community media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.is_admin()
    or exists (
      select 1
      from public.communities c
      where c.id::text = (storage.foldername(name))[1]
        and c.status = 'active'
        and c.posting_mode = 'everyone'
    )
  )
);

drop policy if exists "Public can view community media" on storage.objects;
create policy "Public can view community media"
on storage.objects
for select
to public
using (bucket_id = 'community-media');
