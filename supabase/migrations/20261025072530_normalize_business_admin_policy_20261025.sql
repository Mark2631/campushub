DROP POLICY IF EXISTS "Admins can update businesses" ON public.businesses;
CREATE POLICY "Admins can update businesses"
ON public.businesses
FOR UPDATE TO authenticated
USING (COALESCE(public.is_admin(), false))
WITH CHECK (COALESCE(public.is_admin(), false));
