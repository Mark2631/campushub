-- Expose a seller's voluntary WhatsApp contact only for an active, publicly tradable listing.
-- Keep marketplace_profiles.phone_number private for non-sellers.
CREATE OR REPLACE FUNCTION public.get_listing_seller_whatsapp(p_listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT NULLIF(BTRIM(p.phone_number), '')
  FROM public.listings AS l
  JOIN public.profiles AS p ON p.id = l.seller_id
  WHERE l.id = p_listing_id
    AND l.status = 'active'
    AND l.deleted_at IS NULL
    AND COALESCE(l.moderation_status, 'safe') = 'safe'
    AND COALESCE(p.account_status, 'active') = 'active'
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_listing_seller_whatsapp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_seller_whatsapp(uuid) TO anon, authenticated;
