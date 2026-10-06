import { supabase } from './supabase';

export type CheckoutConfig = {
  merchant_name: string;
  merchant_till_display: string;
  platform_fee_percent: number;
  order_expiry_minutes: number;
  max_quantity_per_order: number;
  payment_initiation_available: boolean;
  delivery_enabled: boolean;
  delivery_zones: Array<{ zone_code: string; display_name: string; delivery_fee: number }>;
};

export async function getCheckoutConfig() {
  const { data, error } = await supabase.rpc('get_checkout_config');
  return { data: data as CheckoutConfig | null, error };
}

export async function createMarketplaceOrder(input: {
  listingId: string;
  quantity: number;
  deliveryOption: 'pickup' | 'd_delivery';
  campus: string;
  dropoffLocation: string;
  deliveryZoneCode: string;
  buyerPhone: string;
  idempotencyKey: string;
}) {
  return supabase.rpc('create_marketplace_order', {
    p_listing_id: input.listingId,
    p_quantity: input.quantity,
    p_delivery_option: input.deliveryOption,
    p_campus: input.campus,
    p_dropoff_location: input.dropoffLocation,
    p_delivery_zone_code: input.deliveryZoneCode || null,
    p_buyer_phone: input.buyerPhone,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function requestOrderPayment(orderId: string, buyerPhone: string, idempotencyKey: string) {
  return supabase.rpc('request_order_payment', {
    p_order_id: orderId,
    p_buyer_phone: buyerPhone,
    p_idempotency_key: idempotencyKey,
  });
}

export async function getMyOrders() {
  return supabase.from('orders').select('id, order_number, listing_title_snapshot, quantity, total_amount, order_state, payment_state, delivery_option, created_at, updated_at, expires_at').order('created_at', { ascending: false });
}

export async function getOrderEvents(orderId: string) {
  return supabase.from('order_events').select('id, event_type, previous_order_state, new_order_state, actor_role, safe_metadata, created_at').eq('order_id', orderId).order('created_at', { ascending: true });
}
