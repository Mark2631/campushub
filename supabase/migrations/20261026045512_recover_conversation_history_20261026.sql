-- Conversation history must remain accessible to its participants even if the
-- associated listing is later deleted. New conversation creation still requires
-- an active, safe listing in the current institution via the INSERT policy.
-- Keep all existing conversation reads/writes limited to the two participants
-- who share the caller's active institution.

drop policy if exists hardening_conversations_institution on public.conversations;
create policy hardening_conversations_institution
  on public.conversations
  as restrictive
  for all to authenticated
  using (
    (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
    and (select private.shares_current_active_institution(buyer_id))
    and (select private.shares_current_active_institution(seller_id))
  )
  with check (
    (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
    and (select private.shares_current_active_institution(buyer_id))
    and (select private.shares_current_active_institution(seller_id))
  );

-- Make the participant hide RPC's return state explicit. It must never report
-- success when RLS or a missing conversation prevented the update.
create or replace function public.hide_conversation_for_user(p_conversation_id uuid)
returns boolean
language plpgsql
security invoker
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
       when v_user_id = any(coalesce(hidden_for, array[]::uuid[])) then coalesce(hidden_for, array[]::uuid[])
       else array_append(coalesce(hidden_for, array[]::uuid[]), v_user_id)
     end
   where id = p_conversation_id
     and (buyer_id = v_user_id or seller_id = v_user_id);

  return found;
end;
$function$;

revoke all on function public.hide_conversation_for_user(uuid) from public, anon;
grant execute on function public.hide_conversation_for_user(uuid) to authenticated;
