-- Backfill institutions from existing `campus` values and add RLS policies
-- Date: 2026-08-08
-- IMPORTANT: Run in a staging environment first. Take a DB dump before applying to production.

BEGIN;

-- 1) Create institutions table if it doesn't exist (id as uuid)
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

-- 2) Insert one institution row per distinct, non-null campus value found across core tables
WITH distinct_campuses AS (
  SELECT DISTINCT campus FROM (
    SELECT campus FROM public.listings
    UNION ALL
    SELECT campus FROM public.profiles
    UNION ALL
    SELECT campus FROM public.item_requests
    UNION ALL
    SELECT campus FROM public.communities
  ) t WHERE campus IS NOT NULL
)
INSERT INTO public.institutions (code, name)
SELECT dc.campus AS code, dc.campus AS name
FROM distinct_campuses dc
LEFT JOIN public.institutions i ON i.code = dc.campus
WHERE i.code IS NULL;

-- 3) Backfill institution_id columns where a matching institution.code exists
-- Note: This script assumes the nullable `institution_id` columns already exist on each table.
-- If you applied the initial migration that added these columns, run the updates below.

UPDATE public.listings l
SET institution_id = i.id
FROM public.institutions i
WHERE l.campus IS NOT NULL AND l.institution_id IS NULL AND l.campus = i.code;

UPDATE public.profiles p
SET institution_id = i.id
FROM public.institutions i
WHERE p.campus IS NOT NULL AND p.institution_id IS NULL AND p.campus = i.code;

UPDATE public.item_requests r
SET institution_id = i.id
FROM public.institutions i
WHERE r.campus IS NOT NULL AND r.institution_id IS NULL AND r.campus = i.code;

UPDATE public.communities c
SET institution_id = i.id
FROM public.institutions i
WHERE c.campus IS NOT NULL AND c.institution_id IS NULL AND c.campus = i.code;

-- If you have a `businesses` table or other tables with `campus`, add similar updates.

-- 4) Verification queries (run and inspect results before proceeding)
-- Count rows that remain without institution_id but have a campus value
-- SELECT 'listings' AS tbl, count(*) FROM public.listings WHERE campus IS NOT NULL AND institution_id IS NULL;
-- SELECT 'profiles' AS tbl, count(*) FROM public.profiles WHERE campus IS NOT NULL AND institution_id IS NULL;
-- SELECT 'item_requests' AS tbl, count(*) FROM public.item_requests WHERE campus IS NOT NULL AND institution_id IS NULL;
-- SELECT 'communities' AS tbl, count(*) FROM public.communities WHERE campus IS NOT NULL AND institution_id IS NULL;

-- 5) (Optional) Add foreign key constraints after you verify backfill is correct
-- ALTER TABLE public.listings ADD CONSTRAINT fk_listings_institution FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
-- ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_institution FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;

-- 6) Row Level Security (RLS) policies
-- The following policy examples use `profiles` table to determine the caller's `institution_id` and `is_admin` flag.
-- Adjust column names if your `profiles` schema differs. Test in staging thoroughly.

-- Enable RLS on target tables (run per-table as desired)
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: allow owners and admins to bypass institution restriction by checking `profiles.is_admin`
-- Policy for SELECT on `listings`:
CREATE POLICY "select_listings_by_institution_or_owner_or_admin" ON public.listings FOR SELECT
USING (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR user_id = auth.uid()
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

CREATE POLICY "insert_listings_with_matching_institution_or_admin" ON public.listings FOR INSERT
WITH CHECK (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

CREATE POLICY "update_listings_owner_or_admin" ON public.listings FOR UPDATE
USING (user_id = auth.uid() OR (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true)
WITH CHECK (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

CREATE POLICY "delete_listings_owner_or_admin" ON public.listings FOR DELETE
USING (user_id = auth.uid() OR (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true);

-- Similar policies for item_requests
CREATE POLICY "select_item_requests_by_institution_or_owner_or_admin" ON public.item_requests FOR SELECT
USING (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR requester_id = auth.uid()
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

CREATE POLICY "insert_item_requests_with_matching_institution_or_admin" ON public.item_requests FOR INSERT
WITH CHECK (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

CREATE POLICY "update_item_requests_owner_or_admin" ON public.item_requests FOR UPDATE
USING (requester_id = auth.uid() OR (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true)
WITH CHECK (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

CREATE POLICY "delete_item_requests_owner_or_admin" ON public.item_requests FOR DELETE
USING (requester_id = auth.uid() OR (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true);

-- Communities: allow members, moderators, and admins, and institution matching
CREATE POLICY "select_communities_by_institution_or_admin" ON public.communities FOR SELECT
USING (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

CREATE POLICY "insert_communities_with_matching_institution_or_admin" ON public.communities FOR INSERT
WITH CHECK (
  (
    institution_id IS NULL
    OR institution_id = (
      SELECT institution_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (
      (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);

-- Profiles: users can read basic profiles, but restrict updates to own profile or admins
CREATE POLICY "select_profiles_basic" ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "update_own_profile_or_admin" ON public.profiles FOR UPDATE
USING (id = auth.uid() OR (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true)
WITH CHECK (id = auth.uid() OR (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true);

-- 7) Notes / next steps:
-- - Run the verification queries above and ensure counts are zero before adding NOT NULL constraints.
-- - Consider adding `institution_id` NOT NULL and FK constraints once proven.
-- - If you require stricter policies (e.g. disallow cross-institution browsing altogether), tighten the USING clauses to remove the `institution_id IS NULL` option.
-- - Always apply these changes in a staging environment and run the app's integration tests.

COMMIT;
