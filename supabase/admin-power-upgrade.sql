-- CampusTrader Admin Power Upgrade
-- Run this in the Supabase SQL Editor after core fixes are stable

-- ============================================================================
-- 1. SCHEMA ADDITIONS AND MODIFICATIONS
-- ============================================================================

-- Add account_status to profiles table
alter table if exists public.profiles
  add column if not exists account_status text not null default 'active' 
  check (account_status in ('active', 'suspended', 'banned'));

-- Add status to businesses table  
alter table if exists public.businesses
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended', 'terminated'));

-- Add admin warning/action tracking
alter table if exists public.profiles
  add column if not exists last_admin_warning timestamptz nullable;

alter table if exists public.profiles
  add column if not exists admin_warnings_count integer not null default 0;

-- Track when listings are hidden/recovered
alter table if exists public.listings
  add column if not exists hidden_reason text nullable;

alter table if exists public.listings
  add column if not exists hidden_by uuid nullable references auth.users(id);

alter table if exists public.listings
  add column if not exists hidden_at timestamptz nullable;

-- ============================================================================
-- 2. ADMIN ACTIONS AUDIT TABLE
-- ============================================================================

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in (
    'user_suspend',
    'user_unblock',
    'user_verify',
    'user_warn',
    'business_approve',
    'business_reject',
    'business_revoke',
    'business_suspend',
    'listing_hide',
    'listing_restore',
    'listing_delete',
    'verification_approve',
    'verification_reject',
    'verification_revoke',
    'report_resolve',
    'user_ban',
    'business_terminate'
  )),
  target_type text not null check (target_type in ('user', 'business', 'listing', 'verification', 'report')),
  target_id uuid not null,
  reason text,
  details text,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

create policy "Admin can view all actions"
on public.admin_actions
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

-- ============================================================================
-- 3. ADMIN NOTIFICATIONS/MESSAGES TABLE
-- ============================================================================

create table if not exists public.admin_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  notice_type text not null check (notice_type in (
    'warning',
    'suspension',
    'ban',
    'verification_rejected',
    'verification_approved',
    'business_rejected',
    'business_approved',
    'listing_removed',
    'report_response'
  )),
  title text not null,
  message text not null,
  related_id uuid,
  read boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.admin_notices enable row level security;

create policy "Users can read own admin notices"
on public.admin_notices
for select
to authenticated
using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create policy "Admin can create notices"
on public.admin_notices
for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create policy "Users can update own notices"
on public.admin_notices
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================================
-- 4. ADMIN ACCESS POLICIES
-- ============================================================================

drop policy if exists "Admin can manage all listings" on public.listings;
create policy "Admin can view all listings"
on public.listings
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create policy "Admin can update any listing"
on public.listings
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create policy "Admin can delete any listing"
on public.listings
for delete
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

-- Admin can view all users
create policy "Admin can view all profiles"
on public.profiles
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com' or auth.uid() = id);

-- Admin can update any profile (for suspensions, badges, etc)
create policy "Admin can update any profile"
on public.profiles
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

-- Admin can view and manage all businesses
create policy "Admin can view all businesses"
on public.businesses
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create policy "Admin can update any business"
on public.businesses
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

-- Admin can view all reports
create policy "Admin can view all reports"
on public.reports
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

create policy "Admin can update reports"
on public.reports
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

-- ============================================================================
-- 5. CREATE REPORTS TABLE IF NOT EXISTS
-- ============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id),
  target_type text not null check (target_type in ('listing', 'user', 'business', 'message')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Users can create reports"
on public.reports
for insert
to authenticated
with check (auth.uid() = reporter_id);

create policy "Users can view own reports"
on public.reports
for select
to authenticated
using (auth.uid() = reporter_id or (auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com');

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_profiles_badge_type on public.profiles(badge_type);
create index if not exists idx_businesses_status on public.businesses(status);
create index if not exists idx_businesses_verification_status on public.businesses(verification_status);
create index if not exists idx_listings_hidden_by on public.listings(hidden_by);
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_admin_actions_admin_id on public.admin_actions(admin_id);
create index if not exists idx_admin_actions_action_type on public.admin_actions(action_type);
create index if not exists idx_admin_notices_user_id on public.admin_notices(user_id);
create index if not exists idx_admin_notices_notice_type on public.admin_notices(notice_type);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_target_type on public.reports(target_type);

-- ============================================================================
-- 7. AUTO-VERIFY ADMINS TRIGGER
-- ============================================================================

-- Function to verify admin on insert into admins table
create or replace function public.verify_admin_profile()
returns trigger as $$
declare
  admin_user_id uuid;
begin
  -- Find the auth user with this email
  select id into admin_user_id from auth.users where email = new.email;
  
  if admin_user_id is not null then
    -- Upsert the profile to set admin status
    insert into public.profiles (id, email, verification_status, badge_type)
    values (admin_user_id, new.email, 'verified', 'admin')
    on conflict (id) do update set
      verification_status = 'verified',
      badge_type = 'admin';
      
    -- Add initial admin notice
    insert into public.admin_notices (user_id, admin_id, notice_type, title, message, read)
    values (
      admin_user_id,
      admin_user_id,
      'verification_approved',
      'Admin Access Granted',
      'Your admin account has been activated. You now have access to the admin panel.',
      true
    );
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Drop old trigger if exists
drop trigger if exists trigger_verify_admin_profile on public.admins;

-- Create trigger
create trigger trigger_verify_admin_profile
after insert on public.admins
for each row
execute function public.verify_admin_profile();

-- ============================================================================
-- 8. GRANT ADMIN EMAIL TO ADMINS TABLE
-- ============================================================================

-- Insert admin if not exists
insert into public.admins (email) values ('mwanginewton107@gmail.com')
on conflict (email) do nothing;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================
-- All tables enabled with RLS
-- All admin policies in place
-- Audit trail ready
-- Admin notices ready
-- Ready for admin power upgrade
