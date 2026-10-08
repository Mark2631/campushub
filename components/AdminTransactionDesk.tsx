'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { supabase } from '../lib/supabase';
import {
  getOrderEvents,
  getOrderParticipantNames,
  getTransactionResultError,
  type OrderEvent,
} from '../lib/orders';

type OrderRow = {
  id: string;
  order_number: string;
  listing_title_snapshot: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  quantity: number;
  total_amount: number;
  platform_fee_amount: number | null;
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
type DeskData = {
  orders: OrderRow[];
  deliveries: DeliveryRow[];
  names: Record<string, string>;
  relatedOrders: Record<string, RelatedOrder>;
  deliveryStates: Record<string, string>;
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
  return ['RELEASED', 'COMPLETED'].includes(normalize(order.seller_release_state))
    || ['RELEASED', 'COMPLETED'].includes(normalize(order.payout_state))
    || normalize(order.order_state) === 'COMPLETED';
}

function orderIsReadyForRelease(order: OrderRow) {
  const sellerAccepted = ['ACCEPTED', 'SELLER_ACCEPTED'].includes(normalize(order.seller_acceptance_state));
  const buyerConfirmed = ['CONFIRMED', 'BUYER_CONFIRMED', 'RECEIVED'].includes(normalize(order.buyer_receipt_state));
  const orderReady = ['READY_FOR_RELEASE', 'RELEASE_ELIGIBLE'].includes(normalize(order.order_state));
  const releaseReady = ['READY_FOR_RELEASE', 'RELEASE_ELIGIBLE'].includes(normalize(order.seller_release_state))
    || normalize(order.payout_state) === 'READY_FOR_RELEASE';
  return sellerAccepted && buyerConfirmed && (orderReady || releaseReady);
}

function buildMetrics(orders: OrderRow[]) {
  const has = (predicate: (order: OrderRow) => boolean) => orders.filter(predicate).length;
  return [
    { label: 'Payment Pending', count: has((order) => ['PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING'].includes(normalize(order.payment_state))) },
    { label: 'Payment Secured', count: has(orderIsPaid) },
    { label: 'Seller Accepted', count: has((order) => ['ACCEPTED', 'SELLER_ACCEPTED'].includes(normalize(order.seller_acceptance_state)) || normalize(order.order_state) === 'SELLER_ACCEPTED') },
    { label: 'Awaiting Handover', count: has((order) => ['AWAITING_HANDOVER', 'DELIVERY_REQUESTED', 'DISPATCH_CONFIRMED', 'IN_TRANSIT'].includes(normalize(order.order_state))) },
    { label: 'Awaiting Buyer Confirmation', count: has((order) => ['DELIVERED', 'AWAITING_CONFIRMATION', 'AWAITING_RECEIPT'].includes(normalize(order.order_state))) },
    { label: 'Ready for Release', count: has((order) => orderIsReadyForRelease(order) && !orderIsDisputed(order) && !orderIsReleased(order)) },
    { label: 'Released', count: has(orderIsReleased) },
    { label: 'Disputed', count: has(orderIsDisputed) },
    { label: 'Refund Pending', count: has((order) => ['REFUND_PENDING', 'REFUND_REQUESTED'].includes(normalize(order.order_state)) || normalize(order.payout_state) === 'REFUND_PENDING') },
    { label: 'Completed', count: has((order) => normalize(order.order_state) === 'COMPLETED') },
  ];
}

function deliveryBucket(state: string) {
  const normalized = normalize(state);
  if (['REQUESTED', 'AWAITING_RIDER', 'SEARCHING_RIDER', 'RIDER_CONTACTED', 'RIDER_CONFIRMED'].includes(normalized)) return 'Pending requests';
  if (['DISPATCH_CONFIRMED', 'PICKED_UP'].includes(normalized)) return 'Dispatched';
  if (normalized === 'IN_TRANSIT') return 'In transit';
  if (normalized === 'DELIVERED') return 'Delivered';
  if (normalized === 'FAILED') return 'Failed';
  if (normalized === 'CANCELLED') return 'Cancelled';
  return 'Pending requests';
}

export default function AdminTransactionDesk({ mode }: { mode: 'escrow' | 'delivery' }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const swrKey = `campustrader-admin-transactions:${mode}`;

  const { data, error, isLoading, mutate } = useSWR<DeskData>(
    swrKey,
    async () => {
      if (mode === 'escrow') {
        const { data: orderRows, error: queryError } = await supabase
          .from('orders')
          .select('id, order_number, listing_title_snapshot, buyer_id, seller_id, listing_id, quantity, total_amount, platform_fee_amount, delivery_fee_snapshot, order_state, payment_state, seller_acceptance_state, seller_release_state, buyer_receipt_state, payout_state, delivery_option, created_at, expires_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (queryError) throw new Error('Admin order records are unavailable for this account or transaction contract.');

        const orders = (orderRows || []) as OrderRow[];
        const orderIds = orders.map((order) => order.id);
        let deliveryStates: Record<string, string> = {};
        if (orderIds.length) {
          const { data: deliveryRows } = await supabase.from('deliveries').select('order_id, delivery_state').in('order_id', orderIds);
          deliveryStates = Object.fromEntries((deliveryRows || []).map((delivery) => [delivery.order_id, delivery.delivery_state]));
        }
        const { data: names } = await getOrderParticipantNames(orders.flatMap((order) => [order.buyer_id, order.seller_id]));
        return { orders, deliveries: [], names: names || {}, relatedOrders: {}, deliveryStates };
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
        const { data: linkedRows } = await supabase
          .from('orders')
          .select('id, order_number, listing_title_snapshot, total_amount')
          .in('id', orderIds);
        relatedOrders = Object.fromEntries((linkedRows || []).map((order) => [order.id, order as RelatedOrder]));
      }
      const { data: names } = await getOrderParticipantNames(deliveries.flatMap((delivery) => [delivery.buyer_id, delivery.seller_id]));
      const deliveryStates = Object.fromEntries(deliveries.map((delivery) => [delivery.order_id, delivery.delivery_state]));
      return { orders: [], deliveries, names: names || {}, relatedOrders, deliveryStates };
    },
    { revalidateOnFocus: true },
  );

  const expandedOrderId = mode === 'escrow'
    ? expandedId
    : data?.deliveries.find((delivery) => delivery.id === expandedId)?.order_id || null;
  const eventKey = expandedOrderId ? ['admin-order-events', expandedOrderId] as const : null;
  const { data: events, error: eventError, isLoading: eventsLoading } = useSWR(
    eventKey,
    async ([, orderId]) => {
      const { data: rows, error: queryError } = await getOrderEvents(orderId);
      if (queryError) throw queryError;
      return (rows || []) as OrderEvent[];
    },
  );

  const orders = data?.orders || [];
  const deliveries = data?.deliveries || [];
  const names = data?.names || {};
  const relatedOrders = data?.relatedOrders || {};
  const deliveryStates = data?.deliveryStates || {};
  const metrics = buildMetrics(orders);
  const deliveryMetrics = ['Pending requests', 'Awaiting rider', 'Dispatched', 'In transit', 'Delivered', 'Failed', 'Cancelled'].map((label) => ({
    label,
    count: deliveries.filter((delivery) => {
      const bucket = deliveryBucket(delivery.delivery_state);
      return label === 'Awaiting rider'
        ? ['REQUESTED', 'AWAITING_RIDER', 'SEARCHING_RIDER'].includes(normalize(delivery.delivery_state))
        : bucket === label;
    }).length,
  }));

  async function releaseOrder(order: OrderRow) {
    if (!window.confirm(`Release transaction ${order.order_number} for ${formatKes(order.total_amount)}? This records a manual action and cannot be undone here.`)) return;
    const note = window.prompt('Enter the release reason or operator note:');
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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{mode === 'escrow' ? 'Escrow' : 'D-Delivery'}</h2>
        <p className="mt-1 text-sm text-zinc-400">Backend-authoritative transaction records. No payment, delivery, or release status is simulated here.</p>
      </div>

      {mode === 'delivery' ? (
        <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          The current delivery backend is rider-account based and does not provide the requested manual destination, receiver, rider name/phone, or admin status controls. This panel is read-only until those backend operations are added; no dispatch action is being sent.
        </div>
      ) : null}
      {feedback ? <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm leading-6 ${feedback.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-blue-500/30 bg-blue-500/10 text-blue-100'}`}>{feedback.text}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error.message}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {(mode === 'escrow' ? metrics : deliveryMetrics).map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-2xl font-bold">{isLoading ? '—' : metric.count}</p>
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
            const itemAmount = Math.max(0, Number(order.total_amount || 0) - Number(order.platform_fee_amount || 0) - Number(order.delivery_fee_snapshot || 0));
            const disputed = orderIsDisputed(order);
            const released = orderIsReleased(order);
            const ready = orderIsReadyForRelease(order) && orderIsPaid(order) && !disputed && !released;
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
                      <Detail label="M-PESA reference" value="Not available in the current admin contract" />
                      <Detail label="Fulfilment" value={pretty(order.delivery_option)} />
                      <Detail label="D-Delivery status" value={normalize(order.delivery_option) === 'D_DELIVERY' ? pretty(deliveryStates[order.id]) : 'Self pickup'} />
                      <Detail label="Seller confirmation" value={pretty(order.seller_acceptance_state)} />
                      <Detail label="Buyer confirmation" value={pretty(order.buyer_receipt_state)} />
                      <Detail label="Dispute status" value={disputed ? 'Under review' : 'No active dispute recorded'} />
                      <Detail label="Release status" value={pretty(order.seller_release_state || order.payout_state)} />
                      <Detail label="Created" value={new Date(order.created_at).toLocaleString('en-KE')} />
                    </dl>

                    <section className="mt-4 rounded-xl border border-zinc-800 p-3" aria-label={`Transaction timeline for ${order.order_number}`}>
                      <h3 className="text-sm font-semibold">Transaction timeline</h3>
                      {eventsLoading ? <p className="mt-2 text-xs text-zinc-500">Loading recorded events…</p> : null}
                      {eventError ? <p className="mt-2 text-xs text-amber-200">Recorded event history is unavailable.</p> : null}
                      {!eventsLoading && !eventError && orderEvents.length === 0 ? <p className="mt-2 text-xs text-zinc-500">No transaction events recorded.</p> : null}
                      {orderEvents.length > 0 ? <ol className="mt-3 space-y-2">{orderEvents.map((event) => <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 text-xs"><span><span className="font-semibold text-zinc-200">{pretty(event.event_type)}</span>{event.new_order_state ? <span className="ml-2 text-zinc-500">→ {pretty(event.new_order_state)}</span> : null}</span><time className="text-zinc-500">{new Date(event.created_at).toLocaleString('en-KE')}</time></li>)}</ol> : null}
                    </section>

                    {ready ? (
                      <button type="button" onClick={() => releaseOrder(order)} disabled={workingId !== null} className="mt-4 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {workingId === order.id ? 'Recording release…' : 'Release transaction'}
                      </button>
                    ) : null}
                    {disputed ? <p className="mt-4 text-sm font-semibold text-amber-200">Transaction under review. Release is blocked while the dispute is active.</p> : null}
                    {released ? <p className="mt-4 text-sm font-semibold text-emerald-200">Release is recorded by the backend.</p> : null}
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
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-sm sm:grid-cols-3">
                    <Detail label="Order ID" value={delivery.order_id} />
                    <Detail label="Destination / location" value="Not stored in the current delivery contract" />
                    <Detail label="Rider" value={delivery.assigned_rider_id ? 'Rider account assigned; contact details are unavailable here' : 'Awaiting rider assignment'} />
                    <Detail label="Rider phone" value="Not stored in the current manual-operation contract" />
                    <Detail label="Delivery fee" value={formatKes(Number(delivery.delivery_fee_snapshot))} />
                    <Detail label="Requested" value={new Date(delivery.requested_at).toLocaleString('en-KE')} />
                    <Detail label="Status" value={pretty(delivery.delivery_state)} />
                  </dl>
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
