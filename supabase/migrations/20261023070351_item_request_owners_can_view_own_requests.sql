-- Request authors can always find/manage their own requests, including if their campus context changes.
drop policy if exists hardening_requests_select_institution on public.item_requests;
create policy hardening_requests_select_institution
on public.item_requests as restrictive
for select to authenticated
using (
  (institution_id is not null
   and institution_id = (select private.current_active_institution_id())
   and status = 'open')
  or user_id = (select auth.uid())
  or coalesce(public.is_admin(), false)
);

drop policy if exists hardening_requests_select_scoped on public.item_requests;
create policy hardening_requests_select_scoped
on public.item_requests as restrictive
for select to authenticated
using (
  (institution_id is not null
   and institution_id = (select private.current_active_institution_id())
   and status = 'open')
  or user_id = (select auth.uid())
  or coalesce(public.is_admin(), false)
);
