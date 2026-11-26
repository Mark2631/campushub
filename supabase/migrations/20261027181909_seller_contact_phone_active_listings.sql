-- Saved WhatsApp contact numbers are visible only on seller profiles with an active listing.
-- Keep phone details hidden for accounts without an active listing.
-- The profile owner controls the number through signup or Edit profile.
CREATE OR REPLACE VIEW public.marketplace_profiles AS
SELECT p.id, p.full_name, p.avatar_url,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.seller_id = p.id AND l.status = 'active'
  ) THEN p.phone_number ELSE NULL::text END AS phone_number,
  p.badge_type, p.verification_status, p.created_at
FROM public.profiles p
WHERE COALESCE(p.account_status, 'active'::text) = 'active'::text;
