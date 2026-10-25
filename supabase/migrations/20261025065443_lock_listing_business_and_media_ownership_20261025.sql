-- Applied to live Campus Hub on 2026-10-25.
-- Remove accidental cross-user modification rights inherited from institution-only RLS.
DROP POLICY IF EXISTS "hardening_listings_update_institution" ON public.listings;
DROP POLICY IF EXISTS "hardening_listings_delete_institution" ON public.listings;
DROP POLICY IF EXISTS "hardening_businesses_update_institution" ON public.businesses;

-- Listings and profile media live below the uploader's UUID folder.
DROP POLICY IF EXISTS "Authenticated users can upload listing media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete listing media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update listing media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile media" ON storage.objects;

CREATE POLICY "campustrader_listing_media_insert_owner" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='listing-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "campustrader_listing_media_update_owner" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id='listing-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text)
WITH CHECK (bucket_id='listing-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "campustrader_listing_media_delete_owner" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id='listing-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);

CREATE POLICY "campustrader_profile_media_insert_owner" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='profile-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "campustrader_profile_media_update_owner" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id='profile-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text)
WITH CHECK (bucket_id='profile-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "campustrader_profile_media_delete_owner" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id='profile-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
