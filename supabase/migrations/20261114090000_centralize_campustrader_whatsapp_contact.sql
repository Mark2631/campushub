-- Centralize product enquiries through CampusTrader management.
-- Seller contact numbers are no longer exposed through public profile views or listing RPCs.

CREATE OR REPLACE VIEW public.marketplace_profiles AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  NULL::text AS phone_number,
  p.badge_type,
  p.verification_status,
  p.created_at
FROM public.profiles AS p
WHERE COALESCE(p.account_status, 'active'::text) = 'active'::text;

COMMENT ON VIEW public.marketplace_profiles IS
  'Public-safe seller projection. Phone numbers are intentionally hidden; buyers contact CampusTrader management.';

REVOKE ALL ON FUNCTION public.get_listing_seller_whatsapp(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_campustrader_whatsapp()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT NULLIF(BTRIM(p.phone_number), '')
  FROM public.admins AS a
  JOIN public.profiles AS p
    ON lower(p.email) = lower(a.email)
  WHERE p.phone_number IS NOT NULL
    AND NULLIF(BTRIM(p.phone_number), '') IS NOT NULL
    AND COALESCE(p.account_status, 'active'::text) = 'active'::text
  ORDER BY a.created_at ASC NULLS LAST, a.id ASC
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.get_campustrader_whatsapp() IS
  'Returns the configured WhatsApp number for the oldest active CampusTrader administrator only.';

REVOKE ALL ON FUNCTION public.get_campustrader_whatsapp() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campustrader_whatsapp() TO anon, authenticated;
