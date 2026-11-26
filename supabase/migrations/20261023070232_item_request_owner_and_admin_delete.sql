-- Allow request authors to remove their own requests and verified admins to remove any request.
-- Delete authorization is deliberately independent of the active institution so admins can moderate cross-campus requests.
alter table public.item_requests enable row level security;

drop policy if exists delete_item_requests_owner_or_admin on public.item_requests;
drop policy if exists "Users can delete own item requests" on public.item_requests;
drop policy if exists "Admins can delete item requests" on public.item_requests;
drop policy if exists "Request owners and admins can delete item requests" on public.item_requests;

create policy "Request owners and admins can delete item requests"
on public.item_requests
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or coalesce(public.is_admin(), false)
);

grant delete on table public.item_requests to authenticated;
