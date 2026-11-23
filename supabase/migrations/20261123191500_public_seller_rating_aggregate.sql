-- Public seller reputation is aggregate-only. Individual review rows remain protected by RLS.
-- This migration must be reviewed and applied before public rating badges become visible.
CREATE OR REPLACE FUNCTION public.get_public_seller_rating(p_seller_id uuid)
RETURNS TABLE (
  average_rating numeric,
  review_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    ROUND(AVG(r.rating)::numeric, 1) AS average_rating,
    COUNT(*)::bigint AS review_count
  FROM public.reviews AS r
  INNER JOIN public.listings AS reviewed_listing
    ON reviewed_listing.id = r.listing_id
  WHERE p_seller_id IS NOT NULL
    AND r.seller_id = p_seller_id
    AND r.listing_id IS NOT NULL
    AND r.rating BETWEEN 1 AND 5
    AND reviewed_listing.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.listings AS active_listing
      WHERE active_listing.seller_id = p_seller_id
        AND active_listing.status = 'active'
        AND active_listing.deleted_at IS NULL
    );
$function$;

REVOKE ALL ON FUNCTION public.get_public_seller_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_seller_rating(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_seller_rating(uuid) IS
  'Returns only an aggregate rating and count for a seller with an active listing. Never returns review comments or reviewer identity.';
