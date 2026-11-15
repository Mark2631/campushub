-- CampusTrader managed marketplace and participant-pair conversations.
-- Product submissions are private until management reviews them and sets the final price.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_reason text;

-- Existing tenant protection also guards moderation_status. Permit the owner
-- to move their own edited product to the one safe state that requests review,
-- while keeping approval, deletion and other moderation controls admin-only.
CREATE OR REPLACE FUNCTION public.guard_listing_tenant_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'private'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_code text;
  v_owner_lifecycle_update boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_tenant_id := private.current_active_institution_id();

  IF TG_OP = 'INSERT' THEN
    IF v_tenant_id IS NULL THEN
      RAISE EXCEPTION 'active institution required' USING errcode = '42501';
    END IF;

    IF NEW.institution_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'listing institution must match the authenticated profile institution' USING errcode = '42501';
    END IF;

    SELECT CASE WHEN upper(i.code) = 'MUKIRIA TTI' THEN 'MUKIRIA' ELSE i.code END
      INTO v_code
    FROM public.institutions i
    WHERE i.id = v_tenant_id AND i.status = 'active';

    NEW.campus := v_code;
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.hidden_at := NULL;
    NEW.hidden_by := NULL;
    NEW.deleted_at := NULL;
    NEW.deleted_by := NULL;
    RETURN NEW;
  END IF;

  -- Ownership and tenant identity never change during moderation.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.institution_id IS DISTINCT FROM OLD.institution_id
     OR NEW.campus IS DISTINCT FROM OLD.campus
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'listing owner, institution, campus, and creation time are immutable' USING errcode = '42501';
  END IF;

  IF NOT COALESCE(public.is_admin(), false)
     AND (
       (
         NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
         AND NOT (
           auth.uid() = OLD.user_id
           AND auth.uid() = OLD.seller_id
           AND NEW.status = 'hidden'::public.listing_status
           AND NEW.moderation_status = 'pending_review'
         )
       )
       OR NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
       OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
     ) THEN
    RAISE EXCEPTION 'moderation and deletion state can only be changed by an administrator, except an owner may request review for their hidden edit' USING errcode = '42501';
  END IF;

  -- Admins operate across campuses. Non-admins may only change lifecycle
  -- status on their own row when their active institution context differs.
  IF (v_tenant_id IS NULL OR NEW.institution_id IS DISTINCT FROM v_tenant_id)
     AND NOT COALESCE(public.is_admin(), false) THEN
    v_owner_lifecycle_update :=
      auth.uid() = OLD.user_id
      AND auth.uid() = OLD.seller_id
      AND (
        (
          NEW.status IS DISTINCT FROM OLD.status
          AND NEW.status::text IN ('active', 'sold', 'hidden')
          AND (to_jsonb(NEW) - 'status' - 'updated_at') = (to_jsonb(OLD) - 'status' - 'updated_at')
        )
        OR (
          NEW.status = 'hidden'::public.listing_status
          AND NEW.moderation_status = 'pending_review'
        )
      );

    IF NOT v_owner_lifecycle_update THEN
      RAISE EXCEPTION 'active institution required; only the listing owner may change lifecycle status across campus context' USING errcode = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE INDEX IF NOT EXISTS listings_moderation_review_queue_idx
  ON public.listings (created_at DESC)
  WHERE status = 'hidden'::public.listing_status
    AND moderation_status = 'pending_review';

-- Re-review the existing live catalogue so every public price and item
-- description follows the same management-controlled standard.
UPDATE public.listings
SET status = 'hidden'::public.listing_status,
    moderation_status = 'pending_review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    moderation_reason = NULL,
    updated_at = now()
WHERE status = 'active'::public.listing_status;

CREATE OR REPLACE FUNCTION private.force_listing_review_for_non_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE((SELECT public.is_admin()), false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'hidden'::public.listing_status;
    NEW.moderation_status := 'pending_review';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.moderation_reason := NULL;
    RETURN NEW;
  END IF;

  -- A seller may mark a live product as sold. Every other seller edit
  -- removes it from the public catalogue and sends it back for review.
  IF OLD.status = 'active'::public.listing_status
     AND NEW.status IN ('hidden'::public.listing_status, 'sold'::public.listing_status)
     AND NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
    -- Hiding or marking an item sold changes visibility, not the editorial
    -- review state. A content edit explicitly sets pending_review in the client.
    NEW.moderation_status := OLD.moderation_status;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.moderation_reason := OLD.moderation_reason;
  ELSE
    NEW.status := 'hidden'::public.listing_status;
    NEW.moderation_status := 'pending_review';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.moderation_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_force_management_review ON public.listings;
CREATE TRIGGER listings_force_management_review
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION private.force_listing_review_for_non_admin();

DROP POLICY IF EXISTS ct_managed_submissions_insert_guard ON public.listings;
CREATE POLICY ct_managed_submissions_insert_guard
  ON public.listings
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'hidden'::public.listing_status
    AND moderation_status = 'pending_review'
  );

DROP POLICY IF EXISTS ct_managed_submissions_update_guard ON public.listings;
CREATE POLICY ct_managed_submissions_update_guard
  ON public.listings
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE((SELECT public.is_admin()), false)
    OR (
      user_id = (SELECT auth.uid())
      AND seller_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    COALESCE((SELECT public.is_admin()), false)
    OR (
      user_id = (SELECT auth.uid())
      AND seller_id = (SELECT auth.uid())
      AND status IN ('hidden'::public.listing_status, 'sold'::public.listing_status)
      AND moderation_status IN ('pending_review', 'rejected', 'safe')
    )
  );

-- One direct message thread per pair, regardless of which person starts it
-- or how many different products they discuss.
CREATE TEMP TABLE _ct_conversation_merge ON COMMIT DROP AS
SELECT
  id,
  FIRST_VALUE(id) OVER (
    PARTITION BY LEAST(buyer_id, seller_id), GREATEST(buyer_id, seller_id)
    ORDER BY updated_at DESC NULLS LAST, created_at DESC, id
  ) AS keep_id,
  ROW_NUMBER() OVER (
    PARTITION BY LEAST(buyer_id, seller_id), GREATEST(buyer_id, seller_id)
    ORDER BY updated_at DESC NULLS LAST, created_at DESC, id
  ) AS row_rank
FROM public.conversations;

UPDATE public.messages AS message
SET conversation_id = merge.keep_id
FROM _ct_conversation_merge AS merge
WHERE message.conversation_id = merge.id
  AND merge.row_rank > 1;

WITH merged_hidden_users AS (
  SELECT
    merge.keep_id,
    COALESCE(
      ARRAY_AGG(DISTINCT hidden.user_id) FILTER (WHERE hidden.user_id IS NOT NULL),
      '{}'::uuid[]
    ) AS hidden_for
  FROM _ct_conversation_merge AS merge
  JOIN public.conversations AS conversation ON conversation.id = merge.id
  LEFT JOIN LATERAL UNNEST(COALESCE(conversation.hidden_for, '{}'::uuid[])) AS hidden(user_id) ON TRUE
  GROUP BY merge.keep_id
)
UPDATE public.conversations AS conversation
SET hidden_for = merged_hidden_users.hidden_for
FROM merged_hidden_users
WHERE conversation.id = merged_hidden_users.keep_id;

DELETE FROM public.conversations AS conversation
USING _ct_conversation_merge AS merge
WHERE conversation.id = merge.id
  AND merge.row_rank > 1;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_listing_id_buyer_id_seller_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_participant_pair_unique_idx
  ON public.conversations (
    LEAST(buyer_id, seller_id),
    GREATEST(buyer_id, seller_id)
  );

-- Only management creates official groups. Existing official groups become
-- management-posted channels unless management explicitly changes that later.
ALTER TABLE public.communities
  ALTER COLUMN posting_mode SET DEFAULT 'admin_only';

UPDATE public.communities
SET posting_mode = 'admin_only';

DROP POLICY IF EXISTS users_can_request_communities ON public.communities;

-- Admins need to see pending and cross-campus businesses during review.
-- Preserve scoped visibility for ordinary authenticated users.
DROP POLICY IF EXISTS hardening_businesses_select_institution ON public.businesses;
CREATE POLICY hardening_businesses_select_institution
  ON public.businesses
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(public.is_admin(), false)
    OR (
      institution_id IS NOT NULL
      AND institution_id = (SELECT private.current_active_institution_id())
      AND status = 'active'
    )
  );

DROP POLICY IF EXISTS ct_admin_businesses_read ON public.businesses;
CREATE POLICY ct_admin_businesses_read
  ON public.businesses
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (COALESCE(public.is_admin(), false));

-- Admin contact details are deliberately not exposed to the public marketplace.
DROP POLICY IF EXISTS ct_admin_profile_contact_read ON public.profiles;
CREATE POLICY ct_admin_profile_contact_read
  ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (COALESCE(public.is_admin(), false));

DROP POLICY IF EXISTS ct_admin_item_requests_read ON public.item_requests;
CREATE POLICY ct_admin_item_requests_read
  ON public.item_requests
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (COALESCE(public.is_admin(), false));

-- Public customers may reach the CampusTrader management contact, but no
-- client role may call the seller-number lookup RPC.
REVOKE ALL ON FUNCTION public.get_listing_seller_whatsapp(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campustrader_whatsapp() TO anon, authenticated;

COMMIT;
