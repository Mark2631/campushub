drop policy if exists "item_requests_authenticated_scoped_read" on public.item_requests;

create policy "item_requests_authenticated_scoped_read"
on public.item_requests
as permissive
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    status = 'open'
    and institution_id = (
      select p.institution_id
      from public.profiles p
      where p.id = (select auth.uid())
      limit 1
    )
  )
);

comment on policy "item_requests_authenticated_scoped_read" on public.item_requests
is 'Allows authenticated users to read their own requests and open requests from their own institution; restrictive tenant policies remain in force.';
