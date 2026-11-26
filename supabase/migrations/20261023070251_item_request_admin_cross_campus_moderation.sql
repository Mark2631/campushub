-- Admins need a moderation view across campuses; ordinary users remain institution-scoped.
drop policy if exists "Admins can view all item requests" on public.item_requests;
create policy "Admins can view all item requests"
on public.item_requests
for select
to authenticated
using (coalesce(public.is_admin(), false));

drop policy if exists hardening_requests_select_institution on public.item_requests;
create policy hardening_requests_select_institution
on public.item_requests
as restrictive
for select
to authenticated
using (
  (
    institution_id is not null
    and institution_id = (select private.current_active_institution_id())
    and ((status = 'open') or user_id = (select auth.uid()))
  )
  or coalesce(public.is_admin(), false)
);

drop policy if exists hardening_requests_select_scoped on public.item_requests;
create policy hardening_requests_select_scoped
on public.item_requests
as restrictive
for select
to authenticated
using (
  (
    institution_id is not null
    and institution_id = (select private.current_active_institution_id())
    and ((status = 'open') or user_id = (select auth.uid()))
  )
  or coalesce(public.is_admin(), false)
);
