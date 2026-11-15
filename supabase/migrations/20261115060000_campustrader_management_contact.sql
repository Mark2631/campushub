-- Public customer contact endpoint for CampusTrader's managed enquiry flow.
-- It returns one configured, active administrator contact only; seller phone
-- numbers remain private and are never used by the product-page WhatsApp CTA.

CREATE OR REPLACE FUNCTION public.get_campustrader_whatsapp()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT NULLIF(BTRIM(p.phone_number), '')
  FROM public.admins AS a
  JOIN public.profiles AS p
    ON LOWER(p.email) = LOWER(a.email)
  WHERE COALESCE(p.account_status, 'active') = 'active'
    AND NULLIF(BTRIM(p.phone_number), '') IS NOT NULL
  ORDER BY a.created_at ASC, LOWER(a.email) ASC
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.get_campustrader_whatsapp()
IS 'Returns the configured active CampusTrader management WhatsApp contact for public product enquiries.';

REVOKE ALL ON FUNCTION public.get_campustrader_whatsapp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_campustrader_whatsapp() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campustrader_whatsapp() TO anon, authenticated;
