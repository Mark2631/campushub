-- Remove the legacy permissive INSERT policy that let verified users bypass
-- the tighter pending, unofficial, unapproved community-request conditions.
drop policy if exists "Verified users can submit pending communities" on public.communities;
