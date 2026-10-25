-- Checkout configuration includes payment display details and is only fetched by signed-in checkout clients.
REVOKE EXECUTE ON FUNCTION public.get_checkout_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_checkout_config() TO authenticated;
