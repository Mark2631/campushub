-- The marketplace order RPC is the authenticated checkout entry point.
-- Keep the function inaccessible to anonymous users and the implicit PUBLIC role.
begin;

revoke execute on function public.create_marketplace_order(
  uuid, integer, text, text, text, text, text, text, text
) from public, anon;

grant execute on function public.create_marketplace_order(
  uuid, integer, text, text, text, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
commit;
