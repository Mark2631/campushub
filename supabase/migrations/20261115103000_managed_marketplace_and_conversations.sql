-- CampusTrader managed marketplace and participant-pair conversations.
-- Product submissions are private until management reviews them and sets the final price.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_reason text;

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

COMMIT;
