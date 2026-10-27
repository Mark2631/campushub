-- Compatibility for older open clients that submit business profiles without institution_id.
-- The institution is derived only from the authenticated user's own active profile.
-- Existing RLS still enforces both the authenticated owner and active-institution match.

CREATE OR REPLACE FUNCTION public.sync_business_owner_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.user_id;
  ELSIF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.owner_id;
  ELSIF NEW.owner_id <> NEW.user_id THEN
    RAISE EXCEPTION 'owner_id and user_id must identify the same user';
  END IF;

  IF NEW.owner_id IS NULL OR NEW.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'business owner must be the authenticated user';
  END IF;

  IF NEW.institution_id IS NULL THEN
    NEW.institution_id := private.current_active_institution_id();
  END IF;

  IF NEW.institution_id IS NULL THEN
    RAISE EXCEPTION 'business institution must match the authenticated user active institution'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
