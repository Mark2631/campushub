-- Let sellers manage their own listings across lifecycle states without
-- opening another seller's rows or allowing cross-campus content edits.
drop policy if exists "Users can view their own listings" on public.listings;
create policy "Users can view their own listings"
  on public.listings
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and seller_id = (select auth.uid())
  );

drop policy if exists hardening_listings_update_institution on public.listings;
create policy hardening_listings_update_institution
  on public.listings
  as restrictive
  for update
  to authenticated
  using (
    (institution_id is not null and institution_id = (select private.current_active_institution_id()))
    or (user_id = (select auth.uid()) and seller_id = (select auth.uid()))
  )
  with check (
    (institution_id is not null and institution_id = (select private.current_active_institution_id()))
    or (user_id = (select auth.uid()) and seller_id = (select auth.uid()))
  );

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

  -- If the seller's active campus has changed or is not configured, allow
  -- only a lifecycle status change on their own row. All other columns must
  -- remain byte-for-byte equivalent at the JSON representation level.
  if v_tenant_id is null or new.institution_id is distinct from v_tenant_id then
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
