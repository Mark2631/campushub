-- Replace the seller-wide aggregate with a listing-institution-scoped aggregate.
-- Individual review rows remain protected by RLS; this endpoint returns only average + count.
DROP FUNCTION IF EXISTS public.get_public_seller_rating(uuid);

CREATE OR REPLACE FUNCTION public.get_public_seller_rating(
  p_seller_id uuid,
  p_listing_id uuid
)
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
  INNER JOIN public.listings AS target_listing
    ON target_listing.id = p_listing_id
   AND target_listing.seller_id = p_seller_id
   AND target_listing.status = 'active'
   AND target_listing.deleted_at IS NULL
   AND reviewed_listing.institution_id = target_listing.institution_id
  WHERE p_seller_id IS NOT NULL
    AND p_listing_id IS NOT NULL
    AND r.seller_id = p_seller_id
    AND r.listing_id IS NOT NULL
    AND r.rating BETWEEN 1 AND 5
    AND reviewed_listing.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders AS completed_order
      WHERE completed_order.buyer_id = r.reviewer_id
        AND completed_order.seller_id = r.seller_id
        AND completed_order.listing_id = r.listing_id
        AND completed_order.order_state = 'completed'
        AND completed_order.buyer_receipt_state = 'confirmed'
    )
    AND EXISTS (
      SELECT 1
      FROM public.listings AS active_listing
      WHERE active_listing.seller_id = p_seller_id
        AND active_listing.institution_id = target_listing.institution_id
        AND active_listing.status = 'active'
        AND active_listing.deleted_at IS NULL
    );
$function$;

REVOKE ALL ON FUNCTION public.get_public_seller_rating(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_seller_rating(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_seller_rating(uuid, uuid) IS
  'Returns only the aggregate rating and count from completed, receipt-confirmed orders for the institution of the requested active listing. Never returns review comments or reviewer identity.';
