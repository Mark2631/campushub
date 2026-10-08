'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { normalizeKenyanPhone } from '../lib/phoneValidation';
import { supabase } from '../lib/supabase';
import {
  adminRecordManualRefund,
  adminResolveOrderDispute,
  adminUpdateManualDelivery,
  getOrderEvents,
  getOrderFulfillmentDetails,
  getOrderParticipantNames,
  getTransactionResultError,
  type OrderEvent,
  type OrderFulfillmentDetails,
} from '../lib/orders';

type OrderRow = {
  id: string;
  order_number: string;
  listing_title_snapshot: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  quantity: number;
  item_unit_price?: number | null;
  item_subtotal?: number | null;
  platform_fee_percent?: number | null;
  total_amount: number;
  platform_fee_amount: number | null;
  refund_state?: string | null;
  delivery_fee_snapshot: number | null;
  order_state: string;
  payment_state: string;
  seller_acceptance_state: string | null;
  seller_release_state: string | null;
  buyer_receipt_state: string | null;
  payout_state: string | null;
  delivery_option: string;
  created_at: string;
  expires_at?: string | null;
};

type DeliveryRow = {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  delivery_fee_snapshot: number;
  assigned_rider_id: string | null;
  delivery_state: string;
  requested_at: string;
  updated_at: string;
};

type RelatedOrder = { order_number: string; listing_title_snapshot: string; total_amount: number };
type PaymentAttemptRow = {
  id: string;
  order_id: string;
  provider: string;
  attempt_state: string;
  provider_transaction_id: string | null;
  merchant_reference: string | null;
  amount_received: number | null;
  receipt_number: string | null;
  result_code: string | null;
  verified_at: string | null;
  created_at: string;
};
type DisputeRow = {
  id: string;
  order_id: string;
  opened_by: string;
  reason: string;
  description: string;
  evidence_references: string[];
  dispute_state: string;
  admin_decision: string | null;
  resolution_timestamp: string | null;
  refund_settlement_decision: string | null;
  created_at: string;
  updated_at: string;
};
type DeskData = {
  orders: OrderRow[];
  deliveries: DeliveryRow[];
  names: Record<string, string>;
  relatedOrders: Record<string, RelatedOrder>;
  deliveryStates: Record<string, string>;
  paymentAttempts: Record<string, PaymentAttemptRow[]>;
  disputes: Record<string, DisputeRow[]>;
};
type ManualDeliveryDraft = {
  deliveryState: string;
  riderName: string;
  riderPhone: string;
  operatorNote: string;
};

const normalize = (value?: string | null) => String(value || '').trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
const pretty = (value?: string | null) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded';
const formatKes = (value: number) => `KSh ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

function orderIsPaid(order: OrderRow) {
  return ['PAYMENT_SECURED', 'SECURED', 'PAID'].includes(normalize(order.payment_state));
}

function orderIsDisputed(order: OrderRow) {
  return normalize(order.order_state) === 'DISPUTED';
}

function orderIsReleased(order: OrderRow) {
  return ['RELEASED', 'SETTLED', 'COMPLETED'].includes(normalize(order.seller_release_state))
    || ['RELEASED', 'SETTLED', 'COMPLETED'].includes(normalize(order.payout_state))
    || normalize(order.order_state) === 'COMPLETED';
}

function orderIsReadyForRelease(order: OrderRow) {
  const sellerAccepted = ['ACCEPTED', 'SELLER_ACCEPTED'].includes(normalize(order.seller_acceptance_state));
  const buyerConfirmed = ['CONFIRMED', 'BUYER_CONFIRMED', 'RECEIVED'].includes(normalize(order.buyer_receipt_state));
  const releaseEligible = ['ELIGIBLE_FOR_SETTLEMENT', 'READY_FOR_RELEASE', 'RELEASE_ELIGIBLE'].includes(normalize(order.seller_release_state));
  return orderIsPaid(order) && sellerAccepted && buyerConfirmed && releaseEligible;
}

function buildMetrics(orders: OrderRow[]) {
  const has = (predicate: (order: OrderRow) => boolean) => orders.filter(predicate).length;
  return [
    { label: 'Payment Pending', count: has((order) => ['NOT_STARTED', 'STK_REQUESTED', 'PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING', 'PENDING_VERIFICATION'].includes(normalize(order.payment_state))) },
    { label: 'Payment Secured', count: has(orderIsPaid) },
    { label: 'Seller Accepted', count: has((order) => ['ACCEPTED', 'SELLER_ACCEPTED'].includes(normalize(order.seller_acceptance_state)) || normalize(order.order_state) === 'SELLER_ACCEPTED') },
    { label: 'Awaiting Handover', count: has((order) => ['AWAITING_HANDOVER', 'DELIVERY_REQUESTED', 'DISPATCH_CONFIRMED', 'IN_TRANSIT'].includes(normalize(order.order_state))) },
    { label: 'Awaiting Buyer Confirmation', count: has((order) => ['DELIVERED', 'AWAITING_CONFIRMATION', 'AWAITING_RECEIPT'].includes(normalize(order.order_state))) },
    { label: 'Ready for Release', count: has((order) => orderIsReadyForRelease(order) && !orderIsDisputed(order) && !orderIsReleased(order)) },
    { label: 'Released', count: has(orderIsReleased) },
    { label: 'Disputed', count: has(orderIsDisputed) },
    { label: 'Refund Pending', count: has((order) => ['PENDING', 'REFUND_PENDING', 'REFUND_REQUESTED'].includes(normalize(order.refund_state)) || normalize(order.order_state) === 'REFUND_PENDING' || normalize(order.payout_state) === 'REFUND_PENDING') },
    { label: 'Completed', count: has((order) => normalize(order.order_state) === 'COMPLETED') },
  ];
}

function deliveryBucket(state: string) {
  const normalized = normalize(state);
  if (['REQUESTED', 'AWAITING_RIDER', 'SEARCHING_RIDER', 'RIDER_CONTACTED', 'RIDER_CONFIRMED', 'ASSIGNED', 'RIDER_ACCEPTED'].includes(normalized)) return 'Pending requests';
  if (['DISPATCH_CONFIRMED', 'DISPATCHED', 'EN_ROUTE_TO_PICKUP', 'AT_PICKUP', 'PICKED_UP'].includes(normalized)) return 'Dispatched';
  if (['IN_TRANSIT', 'ARRIVED'].includes(normalized)) return 'In transit';
  if (normalized === 'DELIVERED') return 'Delivered';
  if (normalized === 'FAILED') return 'Failed';
  if (normalized === 'CANCELLED') return 'Cancelled';
  return 'Pending requests';
}

function manualDeliveryState(state: string) {
  const normalized = normalize(state);
  if (['SEARCHING_RIDER', 'RIDER_CONTACTED'].includes(normalized)) return 'rider_contacted';
  if (['ASSIGNED', 'RIDER_ACCEPTED', 'RIDER_CONFIRMED'].includes(normalized)) return 'rider_confirmed';
  if (['DISPATCH_CONFIRMED', 'DISPATCHED', 'EN_ROUTE_TO_PICKUP'].includes(normalized)) return 'dispatched';
  if (['AT_PICKUP', 'PICKED_UP'].includes(normalized)) return 'picked_up';
  if (['IN_TRANSIT', 'ARRIVED'].includes(normalized)) return 'in_transit';
  return ['DELIVERED', 'FAILED', 'CANCELLED'].includes(normalized) ? normalized.toLowerCase() : 'requested';
}

const manualDeliveryStates = [
  ['requested', 'Requested'],
  ['rider_contacted', 'Rider contacted'],
  ['rider_confirmed', 'Rider confirmed'],
  ['dispatched', 'Dispatched'],
  ['picked_up', 'Picked up'],
  ['in_transit', 'In transit'],
  ['delivered', 'Delivered'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
] as const;

function disputeIsActive(dispute?: DisputeRow) {
  return Boolean(dispute && !['RESOLVED', 'CLOSED', 'DISMISSED'].includes(normalize(dispute.dispute_state)));
}

export default function AdminTransactionDesk({ mode }: { mode: 'escrow' | 'delivery' }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, ManualDeliveryDraft>>({});
  const [disputeDecision, setDisputeDecision] = useState<'refund_buyer' | 'seller_favored'>('refund_buyer');
  const [disputeNote, setDisputeNote] = useState('');
  const deliveryActionKeys = useRef<Record<string, string>>({});
  const swrKey = `campustrader-admin-transactions:${mode}`;

  const { data, error, isLoading, mutate } = useSWR<DeskData>(
    swrKey,
    async () => {
      if (mode === 'escrow') {
        const { data: orderRows, error: queryError } = await supabase
          .from('orders')
          .select('id, order_number, listing_title_snapshot, buyer_id, seller_id, listing_id, quantity, item_unit_price, item_subtotal, platform_fee_percent, total_amount, platform_fee_amount, delivery_fee_snapshot, order_state, payment_state, seller_acceptance_state, seller_release_state, buyer_receipt_state, refund_state, payout_state, delivery_option, created_at, expires_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (queryError) throw new Error('Admin order records are unavailable for this account or transaction contract.');

        const orders = (orderRows || []) as OrderRow[];
        const orderIds = orders.map((order) => order.id);
        let deliveryRows: Array<{ order_id: string; delivery_state: string }> = [];
        let attemptRows: PaymentAttemptRow[] = [];
        let disputeRows: DisputeRow[] = [];
        if (orderIds.length) {
          const [deliveryResult, attemptResult, disputeResult] = await Promise.all([
            supabase.from('deliveries').select('order_id, delivery_state').in('order_id', orderIds),
            supabase.from('payment_attempts').select('id, order_id, provider, attempt_state, provider_transaction_id, merchant_reference, amount_received, receipt_number, result_code, verified_at, created_at').in('order_id', orderIds).order('created_at', { ascending: false }),
            supabase.from('order_disputes').select('id, order_id, opened_by, reason, description, evidence_references, dispute_state, admin_decision, resolution_timestamp, refund_settlement_decision, created_at, updated_at').in('order_id', orderIds).order('created_at', { ascending: false }),
          ]);
          if (deliveryResult.error || attemptResult.error || disputeResult.error) {
            throw new Error('Payment, dispute, or delivery details are unavailable for this admin session.');
          }
          deliveryRows = (deliveryResult.data || []) as typeof deliveryRows;
          attemptRows = (attemptResult.data || []) as PaymentAttemptRow[];
          disputeRows = (disputeResult.data || []) as DisputeRow[];
        }

        const deliveryStates = Object.fromEntries(deliveryRows.map((delivery) => [delivery.order_id, delivery.delivery_state]));
        const paymentAttempts: Record<string, PaymentAttemptRow[]> = {};
        for (const attempt of attemptRows) paymentAttempts[attempt.order_id] = [...(paymentAttempts[attempt.order_id] || []), attempt];
        const disputes: Record<string, DisputeRow[]> = {};
        for (const dispute of disputeRows) disputes[dispute.order_id] = [...(disputes[dispute.order_id] || []), dispute];
        const { data: names } = await getOrderParticipantNames(orders.flatMap((order) => [order.buyer_id, order.seller_id]));
        return { orders, deliveries: [], names: names || {}, relatedOrders: {}, deliveryStates, paymentAttempts, disputes };
      }

      const { data: deliveryRows, error: queryError } = await supabase
        .from('deliveries')
        .select('id, order_id, buyer_id, seller_id, delivery_fee_snapshot, assigned_rider_id, delivery_state, requested_at, updated_at')
        .order('requested_at', { ascending: false })
        .limit(100);
      if (queryError) throw new Error('Delivery requests are unavailable for this account or transaction contract.');

      const deliveries = (deliveryRows || []) as DeliveryRow[];
      const orderIds = Array.from(new Set(deliveries.map((delivery) => delivery.order_id).filter(Boolean)));
      let relatedOrders: Record<string, RelatedOrder> = {};
      if (orderIds.length) {
        const { data: linkedRows, error: linkedError } = await supabase
          .from('orders')
          .select('id, order_number, listing_title_snapshot, total_amount')
          .in('id', orderIds);
        if (linkedError) throw new Error('Linked order records are unavailable for this admin session.');
        relatedOrders = Object.fromEntries((linkedRows || []).map((order) => [order.id, order as RelatedOrder]));
      }
      const { data: names } = await getOrderParticipantNames(deliveries.flatMap((delivery) => [delivery.buyer_id, delivery.seller_id]));
      const deliveryStates = Object.fromEntries(deliveries.map((delivery) => [delivery.order_id, delivery.delivery_state]));
      return { orders: [], deliveries, names: names || {}, relatedOrders, deliveryStates, paymentAttempts: {}, disputes: {} };
    },
    { revalidateOnFocus: true },
  );

  const expandedOrderId = mode === 'escrow'
    ? expandedId
    : data?.deliveries.find((delivery) => delivery.id === expandedId)?.order_id || null;
  const eventKey = expandedOrderId ? ['admin-order-events', expandedOrderId] as const : null;
  const { data: events, error: eventError, isLoading: eventsLoading, mutate: mutateEvents } = useSWR(
    eventKey,
    async ([, orderId]) => {
      const { data: rows, error: queryError } = await getOrderEvents(orderId);
      if (queryError) throw queryError;
      return (rows || []) as OrderEvent[];
    },
  );
  const fulfillmentKey = expandedOrderId ? ['admin-order-fulfillment', expandedOrderId] as const : null;
  const {
    data: fulfillmentDetails,
    error: fulfillmentError,
    isLoading: fulfillmentLoading,
  } = useSWR<OrderFulfillmentDetails>(
    fulfillmentKey,
    async ([, orderId]) => {
      const { data: raw, error: queryError } = await getOrderFulfillmentDetails(String(orderId));
      if (queryError) throw queryError;
      const details = Array.isArray(raw) ? raw[0] : raw;
      return details && typeof details === 'object' ? details as OrderFulfillmentDetails : {};
    },
  );

  const orders = data?.orders || [];
  const deliveries = data?.deliveries || [];
  const names = data?.names || {};
  const relatedOrders = data?.relatedOrders || {};
  const deliveryStates = data?.deliveryStates || {};
  const paymentAttempts = data?.paymentAttempts || {};
  const disputes = data?.disputes || {};
  const metrics = buildMetrics(orders);
  const deliveryMetrics = ['Pending requests', 'Awaiting rider', 'Dispatched', 'In transit', 'Delivered', 'Failed', 'Cancelled'].map((label) => ({
    label,
    count: deliveries.filter((delivery) => {
      const bucket = deliveryBucket(delivery.delivery_state);
      if (label === 'Pending requests') return ['REQUESTED', 'AWAITING_RIDER'].includes(normalize(delivery.delivery_state));
      if (label === 'Awaiting rider') return ['SEARCHING_RIDER', 'RIDER_CONTACTED', 'ASSIGNED', 'RIDER_ACCEPTED', 'RIDER_CONFIRMED'].includes(normalize(delivery.delivery_state));
      return bucket === label;
    }).length,
  }));

  function getManualDeliveryDraft(delivery: DeliveryRow): ManualDeliveryDraft {
    return deliveryDrafts[delivery.id] || {
      deliveryState: manualDeliveryState(delivery.delivery_state),
      riderName: '',
      riderPhone: '',
      operatorNote: '',
    };
  }

  function updateManualDeliveryDraft(delivery: DeliveryRow, patch: Partial<ManualDeliveryDraft>) {
    setDeliveryDrafts((current) => {
      const existing = current[delivery.id] || {
        deliveryState: manualDeliveryState(delivery.delivery_state),
        riderName: '',
        riderPhone: '',
        operatorNote: '',
      };
      return { ...current, [delivery.id]: { ...existing, ...patch } };
    });
  }

  async function releaseOrder(order: OrderRow) {
    if (!window.confirm(`Record manual payout for ${order.order_number} (${formatKes(order.total_amount)})? Only continue if the external payout has already happened. This app records the admin attestation; it does not transfer money.`)) return;
    const note = window.prompt('Enter the settlement reason or operator note:');
    if (!note?.trim()) return;
    const reference = window.prompt('Enter the settlement/provider reference:');
    if (!reference?.trim()) return;

    setWorkingId(order.id);
    setFeedback(null);
    try {
      const result = await supabase.rpc('admin_record_manual_payout', {
        p_order_id: order.id,
        p_external_reference: reference.trim(),
        p_admin_note: note.trim(),
      });
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) {
        setFeedback({ type: 'error', text: actionError });
      } else {
        setFeedback({ type: 'success', text: 'The backend accepted the manual release record. Verify the updated order status before closing this transaction.' });
      }
      await mutate();
    } catch {
      setFeedback({ type: 'error', text: 'The backend could not record this release. No release status is assumed; refresh the order and try again.' });
    } finally {
      setWorkingId(null);
    }
  }

  async function recordManualRefund(order: OrderRow) {
    if (!window.confirm(`Record an external refund for ${order.order_number}? Continue only after the refund has already been processed outside CampusTrader. This action does not transfer money.`)) return;
    const note = window.prompt('Enter the refund reason or operator note:');
    if (!note?.trim()) return;
    const reference = window.prompt('Enter the external refund reference:');
    if (!reference?.trim()) return;

    setWorkingId(`${order.id}:refund`);
    setFeedback(null);
    try {
      const result = await adminRecordManualRefund(order.id, reference.trim(), note.trim());
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) setFeedback({ type: 'error', text: actionError });
      else setFeedback({ type: 'success', text: 'The backend recorded the admin refund attestation. Confirm the updated refund state before closing this order.' });
      await mutate();
    } catch {
      setFeedback({ type: 'error', text: 'The backend could not record this refund. No refund is assumed; refresh the order before retrying.' });
    } finally {
      setWorkingId(null);
    }
  }

  async function resolveDispute(dispute: DisputeRow) {
    if (!disputeNote.trim()) {
      setFeedback({ type: 'error', text: 'Add an admin note before resolving this dispute.' });
      return;
    }
    const resolutionLabel = disputeDecision === 'refund_buyer' ? 'resolve in the buyer\'s favor' : 'resolve in the seller\'s favor';
    if (!window.confirm(`Confirm this decision: ${resolutionLabel}? This records a dispute decision; it does not send a refund or payout.`)) return;

    setWorkingId(`${dispute.id}:resolve`);
    setFeedback(null);
    try {
      const result = await adminResolveOrderDispute(dispute.id, disputeDecision, disputeNote.trim());
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) setFeedback({ type: 'error', text: actionError });
      else {
        setFeedback({ type: 'success', text: 'The dispute decision was recorded. Any refund or payout remains a separate manually attested operation.' });
        setDisputeNote('');
      }
      await mutate();
      if (expandedOrderId) await mutateEvents();
    } catch {
      setFeedback({ type: 'error', text: 'The backend could not record this dispute decision. No order or payment state is assumed to have changed.' });
    } finally {
      setWorkingId(null);
    }
  }

  async function saveManualDelivery(delivery: DeliveryRow, draft: ManualDeliveryDraft) {
    const operatorNote = draft.operatorNote.trim();
    const riderName = draft.riderName.trim() || fulfillmentDetails?.rider_name || '';
    const rawRiderPhone = draft.riderPhone.trim() || fulfillmentDetails?.rider_phone || '';
    const riderPhone = rawRiderPhone ? normalizeKenyanPhone(rawRiderPhone) : null;
    const requiresRider = !['requested', 'failed', 'cancelled'].includes(draft.deliveryState);

    if (!operatorNote) {
      setFeedback({ type: 'error', text: 'Add an operator note so the delivery update has an audit reason.' });
      return;
    }
    if (requiresRider && (!riderName || !riderPhone)) {
      setFeedback({ type: 'error', text: 'Enter the assigned rider name and a valid Kenyan phone number before confirming dispatch.' });
      return;
    }
    if (rawRiderPhone && !riderPhone) {
      setFeedback({ type: 'error', text: 'Enter a valid Kenyan rider phone number.' });
      return;
    }
    if (!window.confirm(`Save delivery status “${pretty(draft.deliveryState)}” for ${relatedOrders[delivery.order_id]?.order_number || delivery.order_id}? The backend will validate this transition.`)) return;

    deliveryActionKeys.current[delivery.id] ??= crypto.randomUUID();
    setWorkingId(`${delivery.id}:delivery`);
    setFeedback(null);
    try {
      const result = await adminUpdateManualDelivery({
        deliveryId: delivery.id,
        deliveryState: draft.deliveryState,
        riderName,
        riderPhone: riderPhone || '',
        operatorNote,
        idempotencyKey: deliveryActionKeys.current[delivery.id],
      });
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) {
        setFeedback({ type: 'error', text: actionError });
      } else {
        setFeedback({ type: 'success', text: 'The backend accepted the delivery update. Confirm the refreshed order timeline before treating dispatch as complete.' });
        deliveryActionKeys.current[delivery.id] = crypto.randomUUID();
        setDeliveryDrafts((current) => ({
          ...current,
          [delivery.id]: { ...draft, riderName, riderPhone: riderPhone || '', operatorNote: '' },
        }));
      }
      await mutate();
      await mutateEvents();
    } catch {
      setFeedback({ type: 'error', text: 'The backend could not save this delivery update. No rider assignment or delivery status is assumed.' });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{mode === 'escrow' ? 'Escrow' : 'D-Delivery'}</h2>
        <p className="mt-1 text-sm text-zinc-400">Backend-authoritative transaction records. No payment, delivery, or release status is simulated here.</p>
      </div>

      {mode === 'delivery' ? (
        <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          Dispatch is manual in this pilot. Status, rider contact, and private drop-off details are saved only by the backend&apos;s admin operation; if that RPC is not installed, the update will fail without changing the delivery.
        </div>
      ) : null}
      {feedback ? <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm leading-6 ${feedback.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-blue-500/30 bg-blue-500/10 text-blue-100'}`}>{feedback.text}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error.message}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {(mode === 'escrow' ? metrics : deliveryMetrics).map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-2xl font-bold">{isLoading || error ? '—' : metric.count}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">{metric.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? <p className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">Loading transaction records…</p> : null}
      {!isLoading && mode === 'escrow' && orders.length === 0 ? <EmptyState text={error ? 'No administrative order records are available.' : 'No transaction records yet.'} /> : null}
      {!isLoading && mode === 'delivery' && deliveries.length === 0 ? <EmptyState text={error ? 'No administrative delivery requests are available.' : 'No D-Delivery requests yet.'} /> : null}

      {mode === 'escrow' ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const itemAmount = order.item_subtotal != null && Number.isFinite(Number(order.item_subtotal))
              ? Number(order.item_subtotal)
              : Math.max(0, Number(order.total_amount || 0) - Number(order.platform_fee_amount || 0) - Number(order.delivery_fee_snapshot || 0));
            const orderDisputes = disputes[order.id] || [];
            const latestDispute = orderDisputes[0];
            const activeDispute = orderDisputes.find(disputeIsActive);
            const disputed = orderIsDisputed(order) || Boolean(activeDispute);
            const released = orderIsReleased(order);
            const ready = orderIsReadyForRelease(order) && !disputed && !released;
            const refundPending = ['PENDING', 'REFUND_PENDING', 'REFUND_REQUESTED'].includes(normalize(order.refund_state))
              || normalize(order.order_state) === 'REFUND_PENDING'
              || normalize(order.payout_state) === 'REFUND_PENDING';
            const orderPaymentAttempts = paymentAttempts[order.id] || [];
            const latestPaymentAttempt = orderPaymentAttempts[0];
            const normalizedOrderRiderPhone = fulfillmentDetails?.rider_phone ? normalizeKenyanPhone(fulfillmentDetails.rider_phone) : null;
            const isExpanded = expandedId === order.id;
            const orderEvents = isExpanded ? events || [] : [];

            return (
              <article key={order.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : order.id)} aria-expanded={isExpanded} className="flex w-full items-start justify-between gap-4 text-left">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-blue-300">{order.order_number}</span>
                    <span className="mt-2 block font-semibold text-white">{order.listing_title_snapshot}</span>
                    <span className="mt-1 block text-xs text-zinc-500">Buyer: {names[order.buyer_id] || 'CampusTrader user'} · Seller: {names[order.seller_id] || 'CampusTrader user'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-white">{formatKes(order.total_amount)}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{pretty(order.order_state)}</span>
                  </span>
                </button>

                {isExpanded ? (
                  <div className="mt-4 border-t border-zinc-800 pt-4">
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <Detail label="Order ID" value={order.id} />
                      <Detail label="Quantity" value={String(order.quantity)} />
                      <Detail label="Product amount" value={formatKes(itemAmount)} />
                      <Detail label="CampusTrader fee snapshot" value={formatKes(Number(order.platform_fee_amount || 0))} />
                      <Detail label="Delivery fee" value={formatKes(Number(order.delivery_fee_snapshot || 0))} />
                      <Detail label={orderIsPaid(order) ? 'Total paid' : 'Order total'} value={formatKes(Number(order.total_amount))} />
                      <Detail label="M-PESA status" value={pretty(order.payment_state)} />
                      <Detail label="Latest payment attempt" value={latestPaymentAttempt ? pretty(latestPaymentAttempt.attempt_state) : 'No payment attempt recorded'} />
                      <Detail label="Payment reference (recorded)" value={latestPaymentAttempt?.receipt_number || latestPaymentAttempt?.provider_transaction_id || latestPaymentAttempt?.merchant_reference || 'Not recorded'} />
                      <Detail label="Verified amount received" value={latestPaymentAttempt?.verified_at && latestPaymentAttempt.amount_received != null ? formatKes(Number(latestPaymentAttempt.amount_received)) : 'Not verified'} />
                      <Detail label="Fulfilment" value={pretty(order.delivery_option)} />
                      <Detail label="D-Delivery status" value={normalize(order.delivery_option) === 'D_DELIVERY' ? pretty(deliveryStates[order.id]) : 'Self pickup'} />
                      <Detail label="Seller confirmation" value={pretty(order.seller_acceptance_state)} />
                      <Detail label="Buyer confirmation" value={pretty(order.buyer_receipt_state)} />
                      <Detail label="Dispute status" value={disputed ? 'Under review' : 'No active dispute recorded'} />
                      <Detail label="Release status" value={pretty(order.seller_release_state || order.payout_state)} />
                      <Detail label="Created" value={new Date(order.created_at).toLocaleString('en-KE')} />
                    </dl>

                    <section className="mt-4 rounded-xl border border-zinc-800 p-3" aria-label={`Private fulfillment details for ${order.order_number}`}>
                      <h3 className="text-sm font-semibold">Private fulfillment details</h3>
                      {fulfillmentLoading ? <p className="mt-2 text-xs text-zinc-500">Loading authorized fulfillment details…</p> : null}
                      {fulfillmentError ? <p role="status" className="mt-2 text-xs text-amber-200">Private fulfillment details are unavailable for this admin session.</p> : null}
                      {!fulfillmentLoading && !fulfillmentError ? (
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                          <Detail label="Destination zone" value={fulfillmentDetails?.delivery_zone_code ? pretty(fulfillmentDetails.delivery_zone_code) : 'Self pickup / not recorded'} />
                          <Detail label="Pickup location" value={fulfillmentDetails?.pickup_location || 'Not recorded'} />
                          <Detail label="Drop-off location and instructions" value={fulfillmentDetails?.dropoff_location || 'Not recorded'} />
                          <Detail label="Manual rider" value={fulfillmentDetails?.rider_name || 'Awaiting rider assignment'} />
                          <Detail label="Rider phone" value={fulfillmentDetails?.rider_phone || 'Not recorded'} />
                        </dl>
                      ) : null}
                      {normalizedOrderRiderPhone ? <a href={`tel:${normalizedOrderRiderPhone}`} className="mt-3 inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-blue-200">Call rider</a> : null}
                    </section>

                    {latestDispute ? (
                      <section className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3" aria-label={`Dispute for ${order.order_number}`}>
                        <h3 className="text-sm font-semibold text-amber-100">{disputeIsActive(latestDispute) ? 'Dispute under review' : 'Dispute history'}</h3>
                        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                          <Detail label="Reason" value={pretty(latestDispute.reason)} />
                          <Detail label="Status" value={pretty(latestDispute.dispute_state)} />
                          <div className="rounded-lg bg-zinc-900 p-3 sm:col-span-2"><dt className="text-xs text-zinc-500">Buyer report</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{latestDispute.description}</dd></div>
                          {!disputeIsActive(latestDispute) ? <Detail label="Admin decision" value={pretty(latestDispute.admin_decision)} /> : null}
                          {latestDispute.resolution_timestamp ? <Detail label="Resolved" value={new Date(latestDispute.resolution_timestamp).toLocaleString('en-KE')} /> : null}
                        </dl>
                        {disputeIsActive(latestDispute) ? (
                          <div className="mt-3 grid gap-3">
                            <label className="text-xs font-semibold text-zinc-200" htmlFor={`dispute-decision-${latestDispute.id}`}>
                              Admin decision
                              <select id={`dispute-decision-${latestDispute.id}`} value={disputeDecision} onChange={(event) => setDisputeDecision(event.target.value as 'refund_buyer' | 'seller_favored')} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm">
                                <option value="refund_buyer">Resolve in buyer&apos;s favor</option>
                                <option value="seller_favored">Resolve in seller&apos;s favor</option>
                              </select>
                            </label>
                            <label className="text-xs font-semibold text-zinc-200" htmlFor={`dispute-note-${latestDispute.id}`}>
                              Decision note
                              <textarea id={`dispute-note-${latestDispute.id}`} value={disputeNote} onChange={(event) => setDisputeNote(event.target.value)} maxLength={1200} rows={3} className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm" />
                            </label>
                            <button type="button" onClick={() => resolveDispute(latestDispute)} disabled={workingId !== null} className="justify-self-start rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                              {workingId === `${latestDispute.id}:resolve` ? 'Recording decision…' : 'Resolve dispute'}
                            </button>
                            <p className="text-xs leading-5 text-amber-100/80">This records a decision only. A refund or seller payout remains a separate external action and is never sent from this screen.</p>
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    <section className="mt-4 rounded-xl border border-zinc-800 p-3" aria-label={`Transaction timeline for ${order.order_number}`}>
                      <h3 className="text-sm font-semibold">Transaction timeline</h3>
                      {eventsLoading ? <p className="mt-2 text-xs text-zinc-500">Loading recorded events…</p> : null}
                      {eventError ? <p className="mt-2 text-xs text-amber-200">Recorded event history is unavailable.</p> : null}
                      {!eventsLoading && !eventError && orderEvents.length === 0 ? <p className="mt-2 text-xs text-zinc-500">No transaction events recorded.</p> : null}
                      {orderEvents.length > 0 ? <ol className="mt-3 space-y-2">{orderEvents.map((event) => <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 text-xs"><span><span className="font-semibold text-zinc-200">{pretty(event.event_type)}</span>{event.new_order_state ? <span className="ml-2 text-zinc-500">→ {pretty(event.new_order_state)}</span> : null}</span><time className="text-zinc-500">{new Date(event.created_at).toLocaleString('en-KE')}</time></li>)}</ol> : null}
                    </section>

                    {ready ? (
                      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                        <button type="button" onClick={() => releaseOrder(order)} disabled={workingId !== null} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                          {workingId === order.id ? 'Recording payout…' : 'Record manual payout'}
                        </button>
                        <p className="mt-2 text-xs leading-5 text-emerald-100/80">Only use this after the external settlement has already happened. This records the admin attestation and does not transfer funds.</p>
                      </div>
                    ) : null}
                    {refundPending ? (
                      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                        <button type="button" onClick={() => recordManualRefund(order)} disabled={workingId !== null} className="rounded-xl bg-amber-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                          {workingId === `${order.id}:refund` ? 'Recording refund…' : 'Record manual refund'}
                        </button>
                        <p className="mt-2 text-xs leading-5 text-amber-100/80">This records an external refund that has already been processed; it does not send money.</p>
                      </div>
                    ) : null}
                    {disputed ? <p className="mt-4 text-sm font-semibold text-amber-200">Transaction under review. Payout is blocked while the dispute is active.</p> : null}
                    {released ? <p className="mt-4 text-sm font-semibold text-emerald-200">Manual payout status is recorded by the backend.</p> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery) => {
            const linkedOrder = relatedOrders[delivery.order_id];
            const isExpanded = expandedId === delivery.id;
            const draft = getManualDeliveryDraft(delivery);
            const knownRiderName = draft.riderName || fulfillmentDetails?.rider_name || '';
            const knownRiderPhone = draft.riderPhone || fulfillmentDetails?.rider_phone || '';
            const normalizedRiderPhone = knownRiderPhone ? normalizeKenyanPhone(knownRiderPhone) : null;
            return (
              <article key={delivery.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : delivery.id)} aria-expanded={isExpanded} className="flex w-full items-start justify-between gap-4 text-left">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-blue-300">{linkedOrder?.order_number || delivery.order_id}</span>
                    <span className="mt-2 block font-semibold text-white">{linkedOrder?.listing_title_snapshot || 'D-Delivery request'}</span>
                    <span className="mt-1 block text-xs text-zinc-500">Buyer: {names[delivery.buyer_id] || 'CampusTrader user'} · Seller: {names[delivery.seller_id] || 'CampusTrader user'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-white">{formatKes(Number(delivery.delivery_fee_snapshot))}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{pretty(delivery.delivery_state)}</span>
                  </span>
                </button>
                {isExpanded ? (
                  <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                    <section aria-label={`Dispatch details for ${linkedOrder?.order_number || delivery.order_id}`}>
                      <h3 className="text-sm font-semibold">Request and handoff details</h3>
                      {fulfillmentLoading ? <p className="mt-2 text-xs text-zinc-500">Loading private fulfillment details…</p> : null}
                      {fulfillmentError ? <p role="status" className="mt-2 text-xs text-amber-200">Private location and contact details are unavailable for this admin session.</p> : null}
                      {!fulfillmentLoading && !fulfillmentError ? (
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                          <Detail label="Order ID" value={delivery.order_id} />
                          <Detail label="Destination zone" value={fulfillmentDetails?.delivery_zone_code ? pretty(fulfillmentDetails.delivery_zone_code) : 'Not separately recorded'} />
                          <Detail label="Specific location / instructions" value={fulfillmentDetails?.dropoff_location || 'Not recorded'} />
                          <Detail label="Receiver" value={fulfillmentDetails?.receiver_name || 'Not separately recorded'} />
                          <Detail label="Receiver phone" value={fulfillmentDetails?.receiver_phone || 'Not separately recorded'} />
                          <Detail label="Rider" value={knownRiderName || (delivery.assigned_rider_id ? 'Rider account assigned; manual contact unavailable' : 'Awaiting rider assignment')} />
                          <Detail label="Rider phone" value={knownRiderPhone || 'Awaiting rider assignment'} />
                          <Detail label="Delivery fee" value={formatKes(Number(delivery.delivery_fee_snapshot))} />
                          <Detail label="Requested" value={new Date(delivery.requested_at).toLocaleString('en-KE')} />
                          <Detail label="Status" value={pretty(delivery.delivery_state)} />
                        </dl>
                      ) : null}
                      {normalizedRiderPhone ? <a href={`tel:${normalizedRiderPhone}`} className="mt-3 inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-blue-200">Call rider</a> : null}
                    </section>

                    <section className="rounded-xl border border-zinc-800 p-3" aria-label="Manual delivery operation update">
                      <h3 className="text-sm font-semibold">Manual dispatch update</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">Choose the next real-world status. The backend validates allowed transitions and records the operator note; do not mark delivery complete until the receiver has it.</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-zinc-300" htmlFor={`delivery-state-${delivery.id}`}>
                          Delivery status
                          <select id={`delivery-state-${delivery.id}`} value={draft.deliveryState} onChange={(event) => updateManualDeliveryDraft(delivery, { deliveryState: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm">
                            {manualDeliveryStates.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-zinc-300" htmlFor={`rider-name-${delivery.id}`}>
                          Rider name
                          <input id={`rider-name-${delivery.id}`} value={draft.riderName || fulfillmentDetails?.rider_name || ''} onChange={(event) => updateManualDeliveryDraft(delivery, { riderName: event.target.value })} maxLength={120} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm" />
                        </label>
                        <label className="text-xs font-semibold text-zinc-300" htmlFor={`rider-phone-${delivery.id}`}>
                          Rider phone
                          <input id={`rider-phone-${delivery.id}`} value={draft.riderPhone || fulfillmentDetails?.rider_phone || ''} onChange={(event) => updateManualDeliveryDraft(delivery, { riderPhone: event.target.value })} inputMode="tel" autoComplete="tel" placeholder="0712345678" maxLength={24} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm" />
                        </label>
                        <label className="text-xs font-semibold text-zinc-300 sm:col-span-2" htmlFor={`delivery-note-${delivery.id}`}>
                          Operator note
                          <textarea id={`delivery-note-${delivery.id}`} value={draft.operatorNote} onChange={(event) => updateManualDeliveryDraft(delivery, { operatorNote: event.target.value })} maxLength={1000} rows={2} className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm" />
                        </label>
                      </div>
                      <button type="button" onClick={() => saveManualDelivery(delivery, draft)} disabled={workingId !== null || fulfillmentLoading || Boolean(fulfillmentError)} className="mt-3 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                        {workingId === `${delivery.id}:delivery` ? 'Saving delivery update…' : 'Save dispatch update'}
                      </button>
                    </section>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-zinc-900 p-3"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 break-words text-sm text-zinc-200">{value}</dd></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">{text}</div>;
}
