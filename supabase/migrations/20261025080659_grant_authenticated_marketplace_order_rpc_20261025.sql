-- Checkout creation is intentionally callable only by signed-in buyers.
-- The security-definer implementation validates auth.uid(), listing status, seller identity,
-- inventory, delivery details, payment option and idempotency before creating an order.
REVOKE EXECUTE ON FUNCTION public.create_marketplace_order(uuid, integer, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(uuid, integer, text, text, text, text, text, text, text) TO authenticated;
