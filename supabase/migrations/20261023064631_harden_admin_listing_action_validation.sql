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
