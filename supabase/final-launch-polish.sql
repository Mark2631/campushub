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
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Admin authorization is for signed-in users only; do not inherit the default PUBLIC grant.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

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
create view public.marketplace_profiles
  with (security_invoker = false, security_barrier = true)
as
select
  p.id,
  p.full_name,
  p.avatar_url,
  NULL::text AS phone_number,
  p.badge_type,
  p.verification_status,
  p.created_at
from public.profiles p
where coalesce(p.account_status, 'active') = 'active';

drop view if exists public.marketplace_businesses;
create view public.marketplace_businesses
  with (security_invoker = false, security_barrier = true)
as
select
  b.id,
  b.business_name,
  b.verification_status,
  b.badge_type
from public.businesses b
where coalesce(b.status, 'active') = 'active';

comment on view public.marketplace_profiles is 'Public-safe seller projection only. Phone number is intentionally masked.';
comment on view public.marketplace_businesses is 'Public-safe business projection restricted to active business records.';

revoke all on public.marketplace_profiles from public;
revoke all on public.marketplace_businesses from public;
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



-- Public request discovery: signed-out visitors may read open requests
-- only when they belong to an active institution. Keep the grant and RLS
-- policy together: one controls API reachability; the other controls rows.
alter table public.item_requests enable row level security;
grant select on table public.item_requests to anon;
drop policy if exists hardening_requests_anon_deny on public.item_requests;
drop policy if exists item_requests_public_open_read on public.item_requests;
create policy item_requests_public_open_read
on public.item_requests
for select
to anon
using (
  status = 'open'
  and exists (
    select 1
    from public.institutions i
    where i.id = item_requests.institution_id
      and i.status = 'active'
  )
);


-- Admin listing moderation across institutions; see migration 20261023063947.
-- Make listing moderation genuinely admin-scoped across institutions.
-- Keep the institution boundary for ordinary users; verified admins may act
-- on any listing, with every moderation action audited in the same transaction.

drop policy if exists hardening_listings_update_institution on public.listings;
create policy hardening_listings_update_institution
  on public.listings
  as restrictive
  for update
  to authenticated
  using (
    (institution_id is not null and institution_id = (select private.current_active_institution_id()))
    or (user_id = (select auth.uid()) and seller_id = (select auth.uid()))
    or coalesce(public.is_admin(), false)
  )
  with check (
    (institution_id is not null and institution_id = (select private.current_active_institution_id()))
    or (user_id = (select auth.uid()) and seller_id = (select auth.uid()))
    or coalesce(public.is_admin(), false)
  );

drop policy if exists hardening_listings_delete_institution on public.listings;
create policy hardening_listings_delete_institution
  on public.listings
  as restrictive
  for delete
  to authenticated
  using (
    (institution_id is not null and institution_id = (select private.current_active_institution_id()))
    or coalesce(public.is_admin(), false)
  );

drop policy if exists "Admins can update listings" on public.listings;
create policy "Admins can update listings"
  on public.listings
  for update
  to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

drop policy if exists "Admins can delete listings" on public.listings;
create policy "Admins can delete listings"
  on public.listings
  for delete
  to authenticated
  using (coalesce(public.is_admin(), false));

create or replace function public.guard_listing_tenant_fields()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'private'
as $function$
declare
  v_tenant_id uuid;
  v_code text;
  v_owner_lifecycle_update boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;

  v_tenant_id := private.current_active_institution_id();

  if tg_op = 'INSERT' then
    if v_tenant_id is null then
      raise exception 'active institution required' using errcode = '42501';
    end if;

    if new.institution_id is distinct from v_tenant_id then
      raise exception 'listing institution must match the authenticated profile institution' using errcode = '42501';
    end if;

    select case when upper(i.code) = 'MUKIRIA TTI' then 'MUKIRIA' else i.code end
      into v_code
    from public.institutions i
    where i.id = v_tenant_id and i.status = 'active';

    new.campus := v_code;
    new.created_at := now();
    new.updated_at := now();
    new.hidden_at := null;
    new.hidden_by := null;
    new.deleted_at := null;
    new.deleted_by := null;
    return new;
  end if;

  -- Ownership and tenant identity never change during moderation.
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.seller_id is distinct from old.seller_id
     or new.institution_id is distinct from old.institution_id
     or new.campus is distinct from old.campus
     or new.created_at is distinct from old.created_at then
    raise exception 'listing owner, institution, campus, and creation time are immutable' using errcode = '42501';
  end if;

  if not coalesce(public.is_admin(), false)
     and (new.moderation_status is distinct from old.moderation_status
       or new.hidden_at is distinct from old.hidden_at
       or new.hidden_by is distinct from old.hidden_by
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by) then
    raise exception 'moderation and deletion state can only be changed by an administrator' using errcode = '42501';
  end if;

  -- Admins operate across campuses. Non-admins may only change lifecycle
  -- status on their own row when their active institution context differs.
  if (v_tenant_id is null or new.institution_id is distinct from v_tenant_id)
     and not coalesce(public.is_admin(), false) then
    v_owner_lifecycle_update :=
      auth.uid() = old.user_id
      and auth.uid() = old.seller_id
      and new.status is distinct from old.status
      and new.status::text in ('active', 'sold', 'hidden')
      and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at');

    if not v_owner_lifecycle_update then
      raise exception 'active institution required; only the listing owner may change lifecycle status across campus context' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

-- Use one transaction for the listing mutation and its audit event. The
-- authenticated caller must be a current admin; callers cannot impersonate
-- another admin by passing an arbitrary admin ID.
create or replace function public.admin_moderate_listing(
  p_listing_id uuid,
  p_action text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_listing_id uuid;
  v_action_type text;
begin
  if v_admin_id is null or not coalesce(public.is_admin(), false) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'listing id is required' using errcode = '22004';
  end if;

  if p_action not in ('hide', 'restore', 'delete') then
    raise exception 'unsupported listing moderation action' using errcode = '22023';
  end if;

  if p_action = 'hide' then
    update public.listings
       set status = 'hidden',
           hidden_by = v_admin_id,
           hidden_at = now()
     where id = p_listing_id
     returning id into v_listing_id;
    v_action_type := 'listing_hide';
  elsif p_action = 'restore' then
    update public.listings
       set status = 'active',
           hidden_by = null,
           hidden_at = null,
           deleted_by = null,
           deleted_at = null
     where id = p_listing_id
     returning id into v_listing_id;
    v_action_type := 'listing_restore';
  else
    update public.listings
       set status = 'hidden',
           hidden_by = coalesce(hidden_by, v_admin_id),
           hidden_at = coalesce(hidden_at, now()),
           deleted_by = v_admin_id,
           deleted_at = now()
     where id = p_listing_id
     returning id into v_listing_id;
    v_action_type := 'listing_delete';
  end if;

  if v_listing_id is null then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;

  insert into public.admin_actions (
    admin_id, action_type, target_type, target_id, target_listing_id, reason
  ) values (
    v_admin_id, v_action_type, 'listing', v_listing_id, v_listing_id, nullif(trim(p_reason), '')
  );

  return v_listing_id;
end;
$function$;

revoke all on function public.admin_moderate_listing(uuid, text, text) from public;
revoke all on function public.admin_moderate_listing(uuid, text, text) from anon;
grant execute on function public.admin_moderate_listing(uuid, text, text) to authenticated;



-- Keep NULL or unsupported admin listing actions from falling through to delete.
-- Harden the admin moderation RPC's action validation and keep legacy
-- report/hide/delete calls on the same audited transaction path.
create or replace function public.admin_moderate_listing(
  p_listing_id uuid,
  p_action text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_listing_id uuid;
  v_action_type text;
begin
  if v_admin_id is null or not coalesce(public.is_admin(), false) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'listing id is required' using errcode = '22004';
  end if;

  -- Explicitly reject NULL. SQL three-valued logic would otherwise allow
  -- a NULL action to fall through to the delete branch.
  if p_action is null or p_action not in ('hide', 'restore', 'delete', 'report') then
    raise exception 'unsupported listing moderation action' using errcode = '22023';
  end if;

  if p_action = 'hide' then
    update public.listings
       set status = 'hidden',
           hidden_by = v_admin_id,
           hidden_at = now()
     where id = p_listing_id
     returning id into v_listing_id;
    v_action_type := 'listing_hide';
  elsif p_action = 'restore' then
    update public.listings
       set status = 'active',
           hidden_by = null,
           hidden_at = null,
           deleted_by = null,
           deleted_at = null
     where id = p_listing_id
     returning id into v_listing_id;
    v_action_type := 'listing_restore';
  elsif p_action = 'report' then
    update public.listings
       set status = 'reported'
     where id = p_listing_id
     returning id into v_listing_id;
    v_action_type := 'listing_report';
  else
    update public.listings
       set status = 'hidden',
           hidden_by = coalesce(hidden_by, v_admin_id),
           hidden_at = coalesce(hidden_at, now()),
           deleted_by = v_admin_id,
           deleted_at = now()
     where id = p_listing_id
     returning id into v_listing_id;
    v_action_type := 'listing_delete';
  end if;

  if v_listing_id is null then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;

  insert into public.admin_actions (
    admin_id, action_type, target_type, target_id, target_listing_id, reason
  ) values (
    v_admin_id, v_action_type, 'listing', v_listing_id, v_listing_id, nullif(trim(p_reason), '')
  );

  return v_listing_id;
end;
$function$;

revoke all on function public.admin_moderate_listing(uuid, text, text) from public;
revoke all on function public.admin_moderate_listing(uuid, text, text) from anon;
grant execute on function public.admin_moderate_listing(uuid, text, text) to authenticated;



-- Keep the listing_report action within the admin audit allowlist.
-- Record administrator report actions without weakening the existing action-type allowlist.
alter table public.admin_actions
  drop constraint if exists admin_actions_action_type_check;

alter table public.admin_actions
  add constraint admin_actions_action_type_check
  check (
    action_type = any (array[
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
      'listing_report',
      'verification_approve',
      'verification_reject',
      'verification_revoke',
      'report_resolve',
      'user_ban',
      'business_post_payment_approve',
      'business_post_payment_reject'
    ]::text[])
  );




-- Request owner/admin deletion and cross-campus admin moderation.
alter table public.item_requests enable row level security;
drop policy if exists delete_item_requests_owner_or_admin on public.item_requests;
drop policy if exists "Users can delete own item requests" on public.item_requests;
drop policy if exists "Admins can delete item requests" on public.item_requests;
drop policy if exists "Request owners and admins can delete item requests" on public.item_requests;
create policy "Request owners and admins can delete item requests"
on public.item_requests for delete to authenticated
using (user_id = (select auth.uid()) or coalesce(public.is_admin(), false));
grant delete on table public.item_requests to authenticated;

drop policy if exists "Admins can view all item requests" on public.item_requests;
create policy "Admins can view all item requests"
on public.item_requests for select to authenticated
using (coalesce(public.is_admin(), false));

drop policy if exists hardening_requests_select_institution on public.item_requests;
create policy hardening_requests_select_institution on public.item_requests as restrictive
for select to authenticated
using (
  (institution_id is not null
   and institution_id = (select private.current_active_institution_id())
   and status = 'open')
  or user_id = (select auth.uid())
  or coalesce(public.is_admin(), false)
);
drop policy if exists hardening_requests_select_scoped on public.item_requests;
create policy hardening_requests_select_scoped on public.item_requests as restrictive
for select to authenticated
using (
  (institution_id is not null
   and institution_id = (select private.current_active_institution_id())
   and status = 'open')
  or user_id = (select auth.uid())
  or coalesce(public.is_admin(), false)
);
