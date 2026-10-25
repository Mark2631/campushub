-- Applied to production on 2026-10-25.
-- Admin update/delete on inactive rows needs compatible SELECT visibility.
CREATE POLICY "campustrader_admin_select_all_listings"
ON public.listings FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));
