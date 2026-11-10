-- Buyers may leave one rating per seller/listing only after confirming receipt
-- for a completed order. Existing tenant-aware SELECT policies remain in force.
DROP POLICY IF EXISTS "buyers_can_review_completed_orders" ON public.reviews;

CREATE POLICY "buyers_can_review_completed_orders"
ON public.reviews
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  reviewer_id = (SELECT auth.uid())
  AND reviewer_id <> seller_id
  AND listing_id IS NOT NULL
  AND rating BETWEEN 1 AND 5
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.buyer_id = (SELECT auth.uid())
      AND o.seller_id = reviews.seller_id
      AND o.listing_id = reviews.listing_id
      AND o.order_state = 'completed'
      AND o.buyer_receipt_state = 'confirmed'
  )
);

CREATE INDEX IF NOT EXISTS reviews_seller_created_at_idx
  ON public.reviews (seller_id, created_at DESC);

-- Publish aggregate ratings only; reviewer identities and comments stay private.
CREATE OR REPLACE VIEW public.marketplace_seller_rating_summary
WITH (security_barrier = true)
AS
SELECT
  seller_id,
  ROUND(AVG(rating)::numeric, 1) AS average_rating,
  COUNT(*)::integer AS review_count
FROM public.reviews
GROUP BY seller_id;

GRANT SELECT ON public.marketplace_seller_rating_summary TO anon, authenticated;
