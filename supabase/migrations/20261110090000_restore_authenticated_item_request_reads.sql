-- Authenticated request reads need a PERMISSIVE policy in addition to the existing
-- restrictive institution guards. The previous setup only permitted admins,
-- so normal users could insert but PostgREST could not return the inserted row.
DROP POLICY IF EXISTS "item_requests_authenticated_scoped_read" ON public.item_requests;

CREATE POLICY "item_requests_authenticated_scoped_read"
ON public.item_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (
    status = 'open'
    AND institution_id = (
      SELECT p.institution_id
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      LIMIT 1
    )
  )
);

COMMENT ON POLICY "item_requests_authenticated_scoped_read" ON public.item_requests
IS 'Allows users to read their own requests and open requests from their institution; restrictive tenant policies remain in force.';
