BEGIN;

INSERT INTO public.institutions (name, short_name, slug, county, status, launch_date)
SELECT 'Meru University of Science and Technology', 'MUST', 'must', 'Meru', 'active', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.institutions WHERE slug = 'must');

UPDATE public.profiles p
SET institution_id = i.id
FROM public.institutions i
WHERE i.slug = 'must' AND p.campus = 'MUST' AND p.institution_id IS DISTINCT FROM i.id;

UPDATE public.listings l
SET institution_id = i.id
FROM public.institutions i
WHERE i.slug = 'must' AND l.campus = 'MUST' AND l.institution_id IS DISTINCT FROM i.id;

UPDATE public.businesses b
SET institution_id = i.id
FROM public.institutions i
WHERE i.slug = 'must' AND (b.institution_id IS NULL OR b.institution_id IS DISTINCT FROM i.id);

UPDATE public.item_requests r
SET institution_id = i.id
FROM public.institutions i
WHERE i.slug = 'must' AND r.campus = 'MUST' AND r.institution_id IS DISTINCT FROM i.id;

UPDATE public.communities c
SET institution_id = i.id
FROM public.institutions i
WHERE i.slug = 'must' AND c.campus = 'MUST' AND c.institution_id IS DISTINCT FROM i.id;

COMMIT;
