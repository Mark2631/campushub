-- CampusTrader MUST launch migration.
-- Run in Supabase SQL Editor after the existing core policy scripts.
-- This prepares official Meru University / MUST communities and keeps future campus expansion scoped to defaults.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do update set public = true;

-- Future: campus selection and campus-specific feeds.
alter table if exists public.profiles
  add column if not exists campus text not null default 'MUST';

alter table if exists public.listings
  add column if not exists campus text not null default 'MUST';

alter table if exists public.item_requests
  add column if not exists campus text not null default 'MUST';

-- The old community MVP used text IDs. Keep those rows as legacy tables so the launch schema can use UUIDs cleanly.
do $$
declare
  community_id_type text;
begin
  select data_type into community_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'communities'
    and column_name = 'id';

  if community_id_type is not null and community_id_type <> 'uuid' then
    alter table if exists public.community_messages rename to legacy_community_messages_text_id;
    alter table if exists public.community_members rename to legacy_community_members_text_id;
    alter table if exists public.communities rename to legacy_communities_text_id;
  end if;
end $$;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  campus text not null default 'MUST',
  name text not null,
  description text not null,
  category text not null,
  cover_url text,
  is_official boolean not null default true,
  posting_mode text not null default 'everyone' check (posting_mode in ('everyone', 'admin_only')),
  status text not null default 'active' check (status in ('active', 'archived', 'hidden')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.communities
  add column if not exists posting_mode text not null default 'everyone'
  check (posting_mode in ('everyone', 'admin_only'));

create table if not exists public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text,
  media_urls text[] not null default '{}',
  media_type text not null default 'none' check (media_type in ('none', 'image', 'video', 'mixed')),
  is_pinned boolean not null default false,
  status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  parent_id uuid references public.community_comments(id),
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'like',
  created_at timestamptz not null default now(),
  unique (post_id, user_id, reaction)
);

create or replace function public.is_admin()
returns boolean
language sql
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

do $$
begin
  if to_regclass('public.admin_actions') is not null then
    drop policy if exists "Admin can view all actions" on public.admin_actions;
    create policy "Admin can view all actions"
    on public.admin_actions
    for select
    to authenticated
    using (public.is_admin());

    drop policy if exists "Admins can insert admin actions" on public.admin_actions;
    create policy "Admins can insert admin actions"
    on public.admin_actions
    for insert
    to authenticated
    with check (public.is_admin() and admin_id = auth.uid());
  end if;
end $$;

insert into public.communities (id, campus, name, description, category, is_official, posting_mode, status)
values
  ('11111111-1111-4111-8111-111111111111', 'MUST', 'MUST Marketplace Updates', 'Official updates about marketplace changes, safety tips, announcements, and new features.', 'Announcements', true, 'admin_only', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'MUST', 'Campus Deals', 'Admin-curated student deals, discounts, business offers, and promoted listings.', 'Deals', true, 'everyone', 'active'),
  ('33333333-3333-4333-8333-333333333333', 'MUST', 'Lost & Found', 'Students report lost and found items. Admins can post confirmed lost/found updates.', 'Safety', true, 'everyone', 'active'),
  ('44444444-4444-4444-8444-444444444444', 'MUST', 'Services Around Campus', 'Admin-curated services like hairdressing, repairs, tutoring, laundry, printing, and photography.', 'Services', true, 'everyone', 'active'),
  ('55555555-5555-4555-8555-555555555555', 'MUST', 'School Updates & Useful Links', 'Important student links, portals, school notices, library/e-learning links, and campus resources.', 'Resources', true, 'admin_only', 'active')
on conflict (id) do update set
  campus = excluded.campus,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  is_official = excluded.is_official,
  posting_mode = excluded.posting_mode,
  status = excluded.status,
  updated_at = now();

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;

drop policy if exists "Guests can view active communities" on public.communities;
create policy "Guests can view active communities"
on public.communities
for select
to anon, authenticated
using (status = 'active' and campus = 'MUST');

drop policy if exists "Admins can insert communities" on public.communities;
create policy "Admins can insert communities"
on public.communities
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update communities" on public.communities;
create policy "Admins can update communities"
on public.communities
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Guests can view active community posts" on public.community_posts;
create policy "Guests can view active community posts"
on public.community_posts
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.communities c
    where c.id = community_id and c.status = 'active' and c.campus = 'MUST'
  )
);

drop policy if exists "Admins and open groups can create community posts" on public.community_posts;
drop policy if exists "Admins can create community posts" on public.community_posts;
create policy "Admins and open groups can create community posts"
on public.community_posts
for insert
to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_admin()
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.status = 'active' and c.posting_mode = 'everyone'
    )
  )
);

drop policy if exists "Admins can update community posts" on public.community_posts;
create policy "Admins can update community posts"
on public.community_posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Anyone can view community members" on public.community_members;
create policy "Anyone can view community members"
on public.community_members
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can follow communities" on public.community_members;
create policy "Authenticated users can follow communities"
on public.community_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'
  and exists (select 1 from public.communities c where c.id = community_id and c.status = 'active')
);

drop policy if exists "Authenticated users can comment on active posts" on public.community_comments;
create policy "Authenticated users can comment on active posts"
on public.community_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'active')
);

drop policy if exists "Guests can view active comments" on public.community_comments;
create policy "Guests can view active comments"
on public.community_comments
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "Admins can moderate comments" on public.community_comments;
create policy "Admins can moderate comments"
on public.community_comments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users can react to posts" on public.community_reactions;
create policy "Authenticated users can react to posts"
on public.community_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'active')
);

drop policy if exists "Guests can view reactions" on public.community_reactions;
create policy "Guests can view reactions"
on public.community_reactions
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read community media" on storage.objects;
create policy "Public can read community media"
on storage.objects
for select
to public
using (bucket_id = 'community-media');

drop policy if exists "Admins can upload community media" on storage.objects;
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

create index if not exists idx_communities_campus_status on public.communities(campus, status);
create index if not exists idx_community_members_community on public.community_members(community_id);
create index if not exists idx_community_posts_community_status on public.community_posts(community_id, status, is_pinned, created_at desc);
create index if not exists idx_community_comments_post_status on public.community_comments(post_id, status, created_at);
create index if not exists idx_community_reactions_post on public.community_reactions(post_id);
