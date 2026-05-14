-- CampusTrader community chat MVP.

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do update set public = true;

create table if not exists public.communities (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id text references public.communities(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id text references public.communities(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  content text,
  media_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.communities (id, name, description)
values
  ('campus-deals', 'Campus Deals', 'Share quick deals, discounts, and useful marketplace finds.'),
  ('lost-found', 'Lost & Found', 'Post lost items, found items, and arrange safe returns.'),
  ('services-network', 'Services Network', 'Repairs, tutoring, design, laundry, and student services.')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;

drop policy if exists "Anyone can read communities" on public.communities;
create policy "Anyone can read communities"
on public.communities
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can read community messages" on public.community_messages;
create policy "Anyone can read community messages"
on public.community_messages
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can send community messages" on public.community_messages;
create policy "Authenticated users can send community messages"
on public.community_messages
for insert
to authenticated
with check (sender_id = auth.uid());

drop policy if exists "Users can read community members" on public.community_members;
create policy "Users can read community members"
on public.community_members
for select
to anon, authenticated
using (true);

drop policy if exists "Users can join communities" on public.community_members;
create policy "Users can join communities"
on public.community_members
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Public can read community media" on storage.objects;
create policy "Public can read community media"
on storage.objects
for select
to public
using (bucket_id = 'community-media');

drop policy if exists "Authenticated users can upload community media" on storage.objects;
create policy "Authenticated users can upload community media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[2] = auth.uid()::text
);
