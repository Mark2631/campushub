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
