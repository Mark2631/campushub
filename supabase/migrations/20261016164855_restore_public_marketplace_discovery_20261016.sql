GRANT SELECT (id,user_id,seller_id,business_id,title,description,category,listing_type,price,negotiable,condition,status,location,media_urls,video_url,created_at,updated_at,campus,institution_id) ON TABLE public.listings TO anon;
DROP POLICY IF EXISTS campustrader_public_active_listings_read ON public.listings;
CREATE POLICY campustrader_public_active_listings_read ON public.listings FOR SELECT TO anon, authenticated USING (
 status = 'active'::public.listing_status AND deleted_at IS NULL AND hidden_at IS NULL AND moderation_status = 'safe'
 AND EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = institution_id AND i.status = 'active')
);
