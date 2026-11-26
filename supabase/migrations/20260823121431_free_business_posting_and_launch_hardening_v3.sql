BEGIN;

UPDATE public.listings SET status = 'active', updated_at = now() WHERE status = 'pending_payment';
DROP TABLE IF EXISTS public.business_post_payments CASCADE;

ALTER VIEW IF EXISTS public.marketplace_profiles SET (security_invoker = true);
ALTER VIEW IF EXISTS public.marketplace_businesses SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.set_updated_at() SET search_path = public;
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated users can read admins" ON public.admins;
DROP POLICY IF EXISTS "Admins can insert admin actions" ON public.admin_actions;
DROP POLICY IF EXISTS "Admins can view admin actions" ON public.admin_actions;
DROP POLICY IF EXISTS "Admins can moderate comments" ON public.community_comments;
DROP POLICY IF EXISTS "Admins moderate comments" ON public.community_comments;
DROP POLICY IF EXISTS "Admins can update community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Admins can moderate community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Admins manage community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Admins can update communities" ON public.communities;
DROP POLICY IF EXISTS "Admins manage communities" ON public.communities;
DROP POLICY IF EXISTS "Authenticated users can follow communities" ON public.community_members;
DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
DROP POLICY IF EXISTS "Anyone can view active communities" ON public.communities;
DROP POLICY IF EXISTS "Guests can view active communities" ON public.communities;
DROP POLICY IF EXISTS "Anyone can view active comments" ON public.community_comments;
DROP POLICY IF EXISTS "Guests can view active comments" ON public.community_comments;
DROP POLICY IF EXISTS "Anyone can view active community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Guests can view active community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Guests can view reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can comment on posts" ON public.community_comments;
DROP POLICY IF EXISTS "Authenticated users can comment on active posts" ON public.community_comments;
DROP POLICY IF EXISTS "Users can react to posts" ON public.community_reactions;
DROP POLICY IF EXISTS "Authenticated users can react to posts" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS communities_created_by_idx ON public.communities(created_by);
CREATE INDEX IF NOT EXISTS community_comments_parent_id_idx ON public.community_comments(parent_id);
CREATE INDEX IF NOT EXISTS community_comments_user_id_idx ON public.community_comments(user_id);
CREATE INDEX IF NOT EXISTS community_posts_author_id_idx ON public.community_posts(author_id);
CREATE INDEX IF NOT EXISTS community_reactions_user_id_idx ON public.community_reactions(user_id);
CREATE INDEX IF NOT EXISTS favorites_product_id_idx ON public.favorites(product_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products(category_id);
CREATE INDEX IF NOT EXISTS reviews_listing_id_idx ON public.reviews(listing_id);
CREATE INDEX IF NOT EXISTS reviews_seller_id_idx ON public.reviews(seller_id);
CREATE INDEX IF NOT EXISTS saved_listings_listing_id_idx ON public.saved_listings(listing_id);
CREATE INDEX IF NOT EXISTS listings_seller_id_idx ON public.listings(seller_id);
CREATE INDEX IF NOT EXISTS conversations_listing_id_idx ON public.conversations(listing_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);

UPDATE public.profiles SET campus = 'MUST' WHERE campus IS DISTINCT FROM 'MUST';
UPDATE public.listings SET campus = 'MUST' WHERE campus IS DISTINCT FROM 'MUST';
UPDATE public.item_requests SET campus = 'MUST' WHERE campus IS DISTINCT FROM 'MUST';
UPDATE public.communities SET campus = 'MUST' WHERE campus IS DISTINCT FROM 'MUST';

COMMIT;
