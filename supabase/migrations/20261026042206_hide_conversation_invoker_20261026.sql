-- The updated conversation RLS policy now authorizes participant-only hides,
-- so this RPC no longer needs elevated privileges to update hidden_for.
alter function public.hide_conversation_for_user(uuid) security invoker;
