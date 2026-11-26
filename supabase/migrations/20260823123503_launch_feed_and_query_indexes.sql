BEGIN;

DROP INDEX IF EXISTS public.idx_community_members_community;
DROP INDEX IF EXISTS public.idx_community_reactions_post;

CREATE INDEX IF NOT EXISTS listings_institution_status_created_idx
  ON public.listings (institution_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_campus_status_created_idx
  ON public.listings (campus, status, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS notifications_user_read_created_idx
  ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS businesses_institution_status_created_idx
  ON public.businesses (institution_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS verification_requests_user_status_created_idx
  ON public.verification_requests (user_id, status, created_at DESC);

COMMIT;
