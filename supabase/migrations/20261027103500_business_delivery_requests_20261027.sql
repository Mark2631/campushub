-- Business profile creation requires both owner fields and the account's active institution.
-- Delivery availability is an opt-in signal; service requests remain manual and separate from checkout.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS delivery_available boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.marketplace_businesses
  WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  id,
  business_name,
  verification_status,
  badge_type,
  COALESCE(delivery_available, false) AS delivery_available
FROM public.businesses b
WHERE COALESCE(status, 'active'::text) = 'active'::text;

CREATE TABLE IF NOT EXISTS public.delivery_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_role text NOT NULL CHECK (requester_role IN ('buyer', 'seller')),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  item_description text NOT NULL,
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'rider_assigned', 'completed', 'cancelled')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_service_requests_status_created_idx
  ON public.delivery_service_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_service_requests_requester_created_idx
  ON public.delivery_service_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_service_requests_institution_idx
  ON public.delivery_service_requests (institution_id);

ALTER TABLE public.delivery_service_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.delivery_service_requests TO authenticated;

DROP POLICY IF EXISTS delivery_service_requests_select_requester_or_admin
  ON public.delivery_service_requests;
CREATE POLICY delivery_service_requests_select_requester_or_admin
  ON public.delivery_service_requests
  FOR SELECT TO authenticated
  USING (
    requester_id = (SELECT auth.uid())
    OR COALESCE(public.is_admin(), false)
  );

DROP POLICY IF EXISTS delivery_service_requests_insert_valid_request
  ON public.delivery_service_requests;
CREATE POLICY delivery_service_requests_insert_valid_request
  ON public.delivery_service_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = (SELECT auth.uid())
    AND institution_id = (SELECT private.current_active_institution_id())
    AND status = 'pending'
    AND admin_notes IS NULL
    AND requester_role = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = delivery_service_requests.listing_id
          AND l.seller_id = (SELECT auth.uid())
      ) THEN 'seller'
      ELSE 'buyer'
    END
    AND EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = delivery_service_requests.business_id
        AND b.institution_id = delivery_service_requests.institution_id
        AND COALESCE(b.status, 'active') = 'active'
        AND COALESCE(b.delivery_available, false) = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = delivery_service_requests.listing_id
        AND l.business_id = delivery_service_requests.business_id
        AND l.institution_id = delivery_service_requests.institution_id
        AND l.status = 'active'
        AND l.deleted_at IS NULL
        AND l.hidden_at IS NULL
        AND l.moderation_status = 'safe'
    )
  );

DROP POLICY IF EXISTS delivery_service_requests_admin_update
  ON public.delivery_service_requests;
CREATE POLICY delivery_service_requests_admin_update
  ON public.delivery_service_requests
  FOR UPDATE TO authenticated
  USING (COALESCE(public.is_admin(), false))
  WITH CHECK (COALESCE(public.is_admin(), false));

COMMENT ON TABLE public.delivery_service_requests IS
  'Manual delivery coordination requests. No payment, rider booking, or dispatch is performed automatically.';
COMMENT ON COLUMN public.businesses.delivery_available IS
  'Business can accept a request for CampusTrader to manually coordinate delivery. Does not imply an automatic booking.';
