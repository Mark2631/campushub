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

export type MarketplaceOrder = {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  listing_title_snapshot: string;
  quantity: number;
  total_amount: number;
  platform_fee_amount: number | null;
  delivery_fee_snapshot: number | null;
  order_state: string;
  payment_state: string;
  seller_acceptance_state: string | null;
  buyer_receipt_state: string | null;
  seller_release_state: string | null;
  payout_state: string | null;
  delivery_option: string;
  created_at: string;
  updated_at?: string;
  expires_at?: string | null;
};

export type OrderEvent = {
  id: string;
  event_type: string;
  previous_order_state: string | null;
  new_order_state: string | null;
  actor_role: string | null;
  safe_metadata: Record<string, unknown> | null;
  created_at: string;
};

export function isDirectPurchaseListing(listing: {
  category?: string | null;
  condition?: string | null;
  price?: number | null;
  status?: string | null;
}) {
  const category = String(listing.category ?? '').trim().toLowerCase();
  const condition = String(listing.condition ?? '').trim().toLowerCase();
  const status = String(listing.status ?? '').trim().toLowerCase();

  return status === 'active'
    && Number.isFinite(Number(listing.price))
    && Number(listing.price) > 0
    && condition !== 'service'
    && !['service', 'services', 'request', 'requests', 'wanted'].some((value) => category === value)
    && !/looking for|wanted post|request post/.test(`${category} ${condition}`);
}

export async function getCheckoutConfig() {
  const { data, error } = await supabase.rpc('get_checkout_config');
  const raw = Array.isArray(data) ? data[0] : data;
  if (error || !raw || typeof raw !== 'object') return { data: null, error };

  const value = raw as Record<string, unknown>;
  const platformFeePercent = Number(value.platform_fee_percent);
  const maxQuantity = Number(value.max_quantity_per_order);
  if (!Number.isFinite(platformFeePercent) || !Number.isInteger(maxQuantity) || maxQuantity < 1) {
    return { data: null, error: new Error('Invalid checkout configuration') };
  }

  const zones = Array.isArray(value.delivery_zones) ? value.delivery_zones : [];
  return {
    data: {
      merchant_name: String(value.merchant_name || ''),
      merchant_till_display: String(value.merchant_till_display || ''),
      platform_fee_percent: platformFeePercent,
      order_expiry_minutes: Number(value.order_expiry_minutes) || 0,
      max_quantity_per_order: maxQuantity,
      payment_initiation_available: value.payment_initiation_available === true,
      delivery_enabled: value.delivery_enabled === true,
      delivery_zones: zones.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const zone = entry as Record<string, unknown>;
        const zoneCode = String(zone.zone_code || '');
        const displayName = String(zone.display_name || '');
        const deliveryFee = Number(zone.delivery_fee);
        return zoneCode && displayName && Number.isFinite(deliveryFee) && deliveryFee >= 0
          ? [{ zone_code: zoneCode, display_name: displayName, delivery_fee: deliveryFee }]
          : [];
      }),
    } satisfies CheckoutConfig,
    error: null,
  };
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
  return supabase
    .from('orders')
    .select('id, order_number, buyer_id, seller_id, listing_id, listing_title_snapshot, quantity, total_amount, platform_fee_amount, delivery_fee_snapshot, order_state, payment_state, seller_acceptance_state, buyer_receipt_state, seller_release_state, payout_state, delivery_option, created_at, updated_at, expires_at')
    .order('created_at', { ascending: false })
    .limit(100);
}

export async function getOrderParticipantNames(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { data: {} as Record<string, string>, error: null };

  const { data, error } = await supabase
    .from('marketplace_profiles')
    .select('id, full_name')
    .in('id', uniqueIds);

  const names = Object.fromEntries((data || []).map((profile) => [profile.id, profile.full_name || 'CampusTrader user']));
  return { data: names as Record<string, string>, error };
}

export async function getOrderEvents(orderId: string) {
  return supabase
    .from('order_events')
    .select('id, event_type, previous_order_state, new_order_state, actor_role, safe_metadata, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
}

export async function confirmOrderReceipt(orderId: string) {
  return supabase.rpc('buyer_confirm_order_receipt', { p_order_id: orderId });
}

export async function sellerAcceptOrder(orderId: string) {
  return supabase.rpc('seller_accept_order', { p_order_id: orderId });
}

export async function sellerDeclineOrder(orderId: string) {
  return supabase.rpc('seller_decline_order', { p_order_id: orderId });
}

export async function openOrderDispute(orderId: string, reason: string, description: string) {
  return supabase.rpc('open_order_dispute', {
    p_order_id: orderId,
    p_reason: reason,
    p_description: description,
    p_evidence_references: [],
  });
}

function getErrorPayload(data: unknown) {
  if (Array.isArray(data)) return (data[0] || {}) as Record<string, unknown>;
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
}

export function getTransactionErrorMessage(error: unknown, data: unknown, stage: 'order' | 'payment' | 'general' = 'general') {
  const payload = getErrorPayload(data);
  const errorRecord = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
  const code = String(payload.error_code || payload.code || errorRecord.code || '').toUpperCase();
  const detail = `${code} ${String(payload.message || errorRecord.message || '')}`.toUpperCase();

  if (detail.includes('PAYMENTS_NOT_CONFIGURED') || detail.includes('MPESA_NOT_CONFIGURED')) {
    return 'M-PESA payment setup is not ready yet. No payment was requested. Try again later or contact CampusTrader support.';
  }
  if (detail.includes('PAYMENT_CANCELLED') || detail.includes('CANCELLED BY USER')) {
    return 'The M-PESA request was cancelled. No payment was secured. You can retry the payment request.';
  }
  if (detail.includes('PAYMENT_TIMEOUT') || detail.includes('TIMED OUT')) {
    return 'The M-PESA request timed out. Check your phone before retrying to avoid duplicate prompts.';
  }
  if (detail.includes('PAYMENT_RECEIVED') && detail.includes('ORDER')) {
    return 'Payment was received but order confirmation is still pending backend verification. Check Orders before retrying.';
  }
  if (detail.includes('PAYMENT_PENDING') || detail.includes('WAITING_FOR_CONFIRMATION')) {
    return 'Payment is still pending verification. Check Orders for the server-confirmed status before trying again.';
  }
  if (detail.includes('PAYMENT_VERIFICATION_FAILED') || detail.includes('VERIFICATION_FAILED')) {
    return 'Payment verification failed. The order is not marked as paid. Contact support if money was deducted.';
  }
  if (detail.includes('PAYMENT_FAILED') || detail.includes('STK_FAILED')) {
    return 'The M-PESA payment failed. No payment is marked secured. Check your phone number or payment status before retrying.';
  }
  if (detail.includes('STK_REQUEST_FAILED')) {
    return 'The M-PESA request could not be started. Check the phone number and try again.';
  }
  if (detail.includes('OUT_OF_STOCK') || detail.includes('INSUFFICIENT_INVENTORY') || detail.includes('INVENTORY_NOT_CONFIGURED')) {
    return 'This listing is not available for checkout at the requested quantity. Ask the seller to update its stock.';
  }
  if (detail.includes('LISTING_UNAVAILABLE') || detail.includes('LISTING_NOT_ACTIVE') || detail.includes('LISTING_SOLD')) {
    return 'This listing is no longer available for a new order. Return to the listing to contact the seller.';
  }
  if (detail.includes('ORDER_EXPIRED')) {
    return 'This order expired before payment completed. Return to the listing to start a new order.';
  }
  if (detail.includes('SELLER_DECLINED')) {
    return 'The seller declined this order. The payment remains in the backend refund workflow; no refund is claimed here.';
  }
  if (detail.includes('DISPUT')) {
    return 'This transaction is under review. It cannot be released while a dispute is open.';
  }
  if (stage === 'payment') {
    return 'The payment request could not be confirmed. The order is not marked as paid; check Orders or retry when safe.';
  }
  if (stage === 'order') {
    return 'The order could not be created. No payment was requested. Check listing availability and try again.';
  }
  return 'That transaction action could not be completed. No payment or release status was changed. Please try again or contact support.';
}

export function getTransactionPayload(data: unknown) {
  return getErrorPayload(data);
}

export function getTransactionResultError(error: unknown, data: unknown, stage: 'order' | 'payment' | 'general' = 'general') {
  const payload = getErrorPayload(data);
  const status = String(payload.status || '').toLowerCase();
  if (error || payload.error_code || payload.error || payload.success === false || status === 'error' || status === 'failed') {
    return getTransactionErrorMessage(error || payload.error || payload, data, stage);
  }
  return null;
}
