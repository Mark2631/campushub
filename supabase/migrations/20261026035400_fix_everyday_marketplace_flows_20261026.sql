-- Correct stale display-campus values for existing profiles using the immutable
-- institution foreign key. MUKIRIA is the app's normalized display label.
update public.profiles p
set campus = case when upper(i.code) = 'MUKIRIA TTI' then 'MUKIRIA' else i.code end,
    updated_at = now()
from public.institutions i
where i.id = p.institution_id
  and p.campus is distinct from case when upper(i.code) = 'MUKIRIA TTI' then 'MUKIRIA' else i.code end;

-- The auth trigger must populate campus from the resolved institution instead of
-- letting a table default label a Mukiria account as MUST.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_institution_id uuid;
  v_institution_code text;
  v_campus_code text;
  v_phone text;
begin
  v_institution_code := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'institution_code'), ''),
    nullif(btrim(new.raw_user_meta_data->>'institution'), '')
  );
  v_institution_id := public.resolve_institution_code(v_institution_code);

  if v_institution_id is not null then
    select case when upper(i.code) = 'MUKIRIA TTI' then 'MUKIRIA' else i.code end
      into v_campus_code
    from public.institutions i
    where i.id = v_institution_id and i.status = 'active';
  end if;

  v_campus_code := coalesce(v_campus_code, nullif(btrim(v_institution_code), ''), 'MUST');
  v_phone := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'phone_number'), ''),
    nullif(btrim(new.phone), '')
  );

  insert into public.profiles (
    id, email, full_name, avatar_url, phone_number, campus,
    verification_status, badge_type, role, institution_id
  )
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    v_phone, v_campus_code, 'unverified', 'none', 'user', v_institution_id
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      phone_number = coalesce(public.profiles.phone_number, excluded.phone_number),
      updated_at = now();

  return new;
end;
$function$;

-- Restore everyday buyer/seller flows while keeping all writes institution-scoped.
-- Admin access is explicit and user-controlled requests remain pending until review.

grant select, insert, update, delete on table public.communities to authenticated;
grant select on table public.communities to anon;

drop policy if exists hardening_communities_anon_deny on public.communities;
drop policy if exists hardening_communities_anon_active_only on public.communities;
create policy hardening_communities_anon_active_only
  on public.communities as restrictive
  for select to anon
  using (status = 'active');

drop policy if exists communities_public_active_read on public.communities;
create policy communities_public_active_read
  on public.communities
  for select to anon
  using (status = 'active');

drop policy if exists hardening_communities_select_institution on public.communities;
create policy hardening_communities_select_institution
  on public.communities as restrictive
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      institution_id = (select private.current_active_institution_id())
      and (status = 'active' or created_by = (select auth.uid()))
    )
  );

drop policy if exists hardening_communities_select_scoped on public.communities;
create policy hardening_communities_select_scoped
  on public.communities
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      institution_id = (select private.current_active_institution_id())
      and (status = 'active' or created_by = (select auth.uid()))
    )
  );

drop policy if exists users_can_read_own_community_requests on public.communities;
create policy users_can_read_own_community_requests
  on public.communities
  for select to authenticated
  using (
    created_by = (select auth.uid())
    and status in ('pending', 'rejected')
    and institution_id = (select private.current_active_institution_id())
  );

drop policy if exists hardening_communities_write_institution on public.communities;
create policy hardening_communities_write_institution
  on public.communities as restrictive
  for all to authenticated
  using (
    coalesce(public.is_admin(), false)
    or institution_id = (select private.current_active_institution_id())
  )
  with check (
    coalesce(public.is_admin(), false)
    or institution_id = (select private.current_active_institution_id())
  );

drop policy if exists admins_can_delete_communities on public.communities;
create policy admins_can_delete_communities
  on public.communities
  for delete to authenticated
  using (coalesce(public.is_admin(), false));

drop policy if exists users_can_request_communities on public.communities;
create policy users_can_request_communities
  on public.communities
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and institution_id = (select private.current_active_institution_id())
    and status = 'pending'
    and coalesce(is_official, false) = false
    and approved_by is null
    and approved_at is null
  );

-- Public community pages are intended to be browsable without an account. Only
-- active posts in an active community are visible to anonymous visitors.
grant select on table public.community_posts to anon;

drop policy if exists hardening_community_posts_anon_active_only on public.community_posts;
create policy hardening_community_posts_anon_active_only
  on public.community_posts as restrictive
  for select to anon
  using (
    status = 'active'
    and exists (
      select 1
      from public.communities c
      where c.id = community_posts.community_id
        and c.status = 'active'
    )
  );

drop policy if exists community_posts_public_active_read on public.community_posts;
create policy community_posts_public_active_read
  on public.community_posts
  for select to anon
  using (
    status = 'active'
    and exists (
      select 1
      from public.communities c
      where c.id = community_posts.community_id
        and c.status = 'active'
    )
  );

drop policy if exists hardening_community_posts_select_institution on public.community_posts;
create policy hardening_community_posts_select_institution
  on public.community_posts as restrictive
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      status = 'active'
      and exists (
        select 1
        from public.communities c
        where c.id = community_posts.community_id
          and c.status = 'active'
          and c.institution_id = (select private.current_active_institution_id())
      )
    )
  );

drop policy if exists hardening_community_posts_update_institution on public.community_posts;
create policy hardening_community_posts_update_institution
  on public.community_posts as restrictive
  for update to authenticated
  using (
    coalesce(public.is_admin(), false)
    or exists (
      select 1 from public.communities c
      where c.id = community_posts.community_id
        and c.institution_id = (select private.current_active_institution_id())
    )
  )
  with check (
    coalesce(public.is_admin(), false)
    or exists (
      select 1 from public.communities c
      where c.id = community_posts.community_id
        and c.institution_id = (select private.current_active_institution_id())
    )
  );

-- Atomic per-user conversation hide. Table-level RLS correctly restricts direct
-- writes by active listing/institution; this function safely allows participants
-- to hide older conversations after a listing is sold or moderated.
create or replace function public.hide_conversation_for_user(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.conversations
     set hidden_for = case
       when v_user_id = any(hidden_for) then hidden_for
       else array_append(hidden_for, v_user_id)
     end,
         updated_at = now()
   where id = p_conversation_id
     and (buyer_id = v_user_id or seller_id = v_user_id);

  if not found then
    return false;
  end if;

  return true;
end;
$function$;

revoke all on function public.hide_conversation_for_user(uuid) from public, anon;
grant execute on function public.hide_conversation_for_user(uuid) to authenticated;
