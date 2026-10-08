'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import {
  confirmOrderReceipt,
  getMyOrders,
  getOrderEvents,
  getOrderParticipantNames,
  getTransactionResultError,
  openOrderDispute,
  sellerAcceptOrder,
  sellerDeclineOrder,
  type MarketplaceOrder,
  type OrderEvent,
} from '../lib/orders';

type Props = { userId: string; activeTab: 'buying' | 'selling' };
type DisputeReason = {
  value: string;
  label: string;
};

const disputeReasons: DisputeReason[] = [
  { value: 'ITEM_NOT_RECEIVED', label: 'Item not received' },
  { value: 'WRONG_ITEM', label: 'Wrong item' },
  { value: 'ITEM_NOT_AS_DESCRIBED', label: 'Item not as described' },
  { value: 'DAMAGED_ITEM', label: 'Damaged item' },
  { value: 'SELLER_UNAVAILABLE', label: 'Seller unavailable' },
  { value: 'BUYER_UNAVAILABLE', label: 'Buyer unavailable' },
  { value: 'DELIVERY_PROBLEM', label: 'Delivery issue' },
  { value: 'PAYMENT_PROBLEM', label: 'Payment issue' },
  { value: 'OTHER', label: 'Other' },
];

const normalizeState = (value?: string | null) => String(value || '').trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
const prettyState = (value?: string | null) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not available';
const prettyPaymentState = (value?: string | null) => {
  const state = normalizeState(value);
  if (['STK_REQUESTED', 'REQUEST_SENT'].includes(state)) return 'Payment request sent';
  if (['PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING'].includes(state)) return 'Payment pending';
  if (['PAYMENT_SECURED', 'SECURED', 'PAID'].includes(state)) return 'Payment secured';
  if (['FAILED', 'PAYMENT_FAILED', 'STK_FAILED'].includes(state)) return 'Payment failed';
  if (['CANCELLED', 'PAYMENT_CANCELLED'].includes(state)) return 'Payment cancelled';
  if (['VERIFICATION_FAILED', 'PAYMENT_VERIFICATION_FAILED'].includes(state)) return 'Payment verification failed';
  if (state.includes('PAYMENT_RECEIVED') && state.includes('PENDING')) return 'Payment received · order confirmation pending';
  return prettyState(value);
};
const formatKes = (value: number) => `KSh ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

function orderIsPaid(order: MarketplaceOrder) {
  return ['PAYMENT_SECURED', 'SECURED', 'PAID'].includes(normalizeState(order.payment_state));
}

function orderIsClosed(order: MarketplaceOrder) {
  return ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(normalizeState(order.order_state));
}

export default function OrdersActivity({ userId, activeTab }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('ITEM_NOT_RECEIVED');
  const [disputeDescription, setDisputeDescription] = useState('');

  const { data, error, isLoading, mutate } = useSWR(
    userId ? `campustrader-orders:${userId}` : null,
    async () => {
      const { data: rows, error: queryError } = await getMyOrders();
      if (queryError) throw queryError;
      const orders = (rows || []) as MarketplaceOrder[];
      const profileIds = orders.flatMap((order) => [order.buyer_id, order.seller_id]);
      const { data: participantNames } = await getOrderParticipantNames(profileIds);
      return { orders, participantNames };
    },
    {
      revalidateOnFocus: true,
      refreshInterval: (latestData) => latestData?.orders.some((order) => ['STK_REQUESTED', 'PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING'].includes(normalizeState(order.payment_state))) ? 8000 : 0,
    },
  );

  const eventKey = expandedOrderId ? ['campustrader-order-events', expandedOrderId] as const : null;
  const { data: events, error: eventError, isLoading: eventsLoading, mutate: mutateEvents } = useSWR(
    eventKey,
    async ([, orderId]) => {
      const { data: rows, error: queryError } = await getOrderEvents(orderId);
      if (queryError) throw queryError;
      return (rows || []) as OrderEvent[];
    },
  );

  const orders = (data?.orders || []).filter((order) => activeTab === 'buying' ? order.buyer_id === userId : order.seller_id === userId);
  const participantNames = data?.participantNames || {};

  async function runOrderAction(order: MarketplaceOrder, action: 'receipt' | 'accept' | 'decline') {
    if (action === 'receipt' && !window.confirm('Only confirm after you have received and checked your order. This confirmation cannot be undone. Continue?')) return;
    if (action === 'decline' && !window.confirm('Declining sends the order to the backend refund workflow. A refund is not automatic. Continue?')) return;

    setBusyKey(`${order.id}:${action}`);
    setFeedback(null);
    try {
      const result = action === 'receipt'
        ? await confirmOrderReceipt(order.id)
        : action === 'accept'
          ? await sellerAcceptOrder(order.id)
          : await sellerDeclineOrder(order.id);
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) {
        setFeedback({ type: 'error', text: actionError });
      } else {
        const successText = action === 'receipt'
          ? 'Receipt confirmed. The transaction is awaiting the configured release workflow.'
          : action === 'accept'
            ? 'Order accepted. Payment remains protected; prepare the item for handover.'
            : 'Order declined. Refund handling remains subject to backend processing.';
        setFeedback({ type: 'success', text: successText });
      }
      await mutate();
      if (expandedOrderId === order.id) await mutateEvents();
    } catch {
      setFeedback({ type: 'error', text: 'The transaction service could not complete that action. Refresh the order before retrying.' });
    } finally {
      setBusyKey(null);
    }
  }

  async function submitDispute(order: MarketplaceOrder) {
    if (!disputeDescription.trim()) {
      setFeedback({ type: 'error', text: 'Describe the issue before opening a dispute.' });
      return;
    }
    setBusyKey(`${order.id}:dispute`);
    setFeedback(null);
    try {
      const result = await openOrderDispute(order.id, disputeReason, disputeDescription.trim());
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) {
        setFeedback({ type: 'error', text: actionError });
      } else {
        setFeedback({ type: 'success', text: 'Dispute opened. This transaction is under review and cannot be released while the dispute is active.' });
        setDisputeOrderId(null);
        setDisputeDescription('');
      }
      await mutate();
    } catch {
      setFeedback({ type: 'error', text: 'The dispute could not be submitted. Your order remains unchanged; refresh and try again.' });
    } finally {
      setBusyKey(null);
    }
  }

  if (isLoading) {
    return <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">Loading your protected orders…</section>;
  }

  if (error) {
    return (
      <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <p>Orders could not be loaded for this session. Your transaction status has not been changed.</p>
        <button type="button" onClick={() => mutate()} className="mt-3 rounded-xl border border-current px-3 py-2 font-semibold">Retry</button>
      </section>
    );
  }

  return (
    <section className="mt-5 space-y-3">
      {feedback ? <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-4 text-sm leading-6 ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100' : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100'}`}>{feedback.text}</p> : null}

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="font-semibold">{activeTab === 'buying' ? 'No purchases yet.' : 'No sales yet.'}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Orders appear here only after the backend creates them.</p>
          {activeTab === 'buying' ? <Link href="/" className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Browse listings</Link> : null}
        </div>
      ) : null}

      {orders.map((order) => {
        const orderState = normalizeState(order.order_state);
        const sellerState = normalizeState(order.seller_acceptance_state);
        const isBuying = activeTab === 'buying';
        const sellerPending = ['SELLER_PENDING', 'PENDING', 'WAITING'].includes(sellerState) || (!sellerState && orderState === 'SELLER_PENDING');
        const sellerAccepted = ['ACCEPTED', 'SELLER_ACCEPTED'].includes(sellerState) || orderState === 'SELLER_ACCEPTED';
        const canSellerRespond = !isBuying && orderIsPaid(order) && sellerPending && !orderIsClosed(order) && orderState !== 'DISPUTED';
        const canConfirmReceipt = isBuying && orderIsPaid(order) && ['DELIVERED', 'AWAITING_CONFIRMATION', 'AWAITING_RECEIPT', 'HANDED_OVER'].includes(orderState) && orderState !== 'DISPUTED';
        const canDispute = isBuying && !orderIsClosed(order) && orderState !== 'DISPUTED';
        const nameId = isBuying ? order.seller_id : order.buyer_id;
        const personName = participantNames[nameId] || (isBuying ? 'Seller' : 'Buyer');
        const fee = Number(order.platform_fee_amount || 0);
        const deliveryFee = Number(order.delivery_fee_snapshot || 0);
        const productAmount = Math.max(0, Number(order.total_amount || 0) - fee - deliveryFee);
        const isExpanded = expandedOrderId === order.id;
        const orderEvents = isExpanded ? events || [] : [];

        return (
          <article key={order.id} id={isBuying ? 'buying' : 'selling'} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">{order.order_number || order.id}</p>
                <h2 className="mt-2 font-bold">{order.listing_title_snapshot || 'CampusTrader order'}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{isBuying ? 'Seller' : 'Buyer'}: {personName}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{new Date(order.created_at).toLocaleString('en-KE')}</p>
              </div>
              <p className="font-bold">{formatKes(Number(order.total_amount))}</p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-zinc-950 sm:grid-cols-3">
              <div><dt className="text-xs text-slate-500 dark:text-zinc-500">Quantity</dt><dd className="mt-1 font-semibold">{order.quantity}</dd></div>
              <div><dt className="text-xs text-slate-500 dark:text-zinc-500">Fulfilment</dt><dd className="mt-1 font-semibold">{prettyState(order.delivery_option)}</dd></div>
              <div><dt className="text-xs text-slate-500 dark:text-zinc-500">Payment</dt><dd className="mt-1 font-semibold">{prettyPaymentState(order.payment_state)}</dd></div>
              <div><dt className="text-xs text-slate-500 dark:text-zinc-500">Order status</dt><dd className="mt-1 font-semibold">{prettyState(order.order_state)}</dd></div>
              <div><dt className="text-xs text-slate-500 dark:text-zinc-500">Product amount</dt><dd className="mt-1 font-semibold">{formatKes(productAmount)}</dd></div>
                <div><dt className="text-xs text-slate-500 dark:text-zinc-500">Platform + delivery fees</dt><dd className="mt-1 font-semibold">{formatKes(fee + deliveryFee)}</dd></div>
                {order.expires_at && ['PENDING_PAYMENT', 'PAYMENT_PENDING', 'SELLER_PENDING'].includes(orderState) ? <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-slate-500 dark:text-zinc-500">Order expires</dt><dd className="mt-1 font-semibold">{new Date(order.expires_at).toLocaleString('en-KE')}</dd></div> : null}
              </dl>

            {isBuying && orderState === 'DISPUTED' ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">Transaction under review. It cannot be released while this dispute is active.</p> : null}
            {!isBuying && orderIsPaid(order) ? (
              <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                Payment secured. {sellerAccepted ? 'Order accepted; please prepare the item.' : sellerPending ? 'Waiting for your response.' : prettyState(order.seller_acceptance_state)} Settlement is operator-managed after handover and buyer confirmation; no automatic payout is promised.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {!isBuying && canSellerRespond ? (
                <>
                  <button type="button" onClick={() => runOrderAction(order, 'accept')} disabled={busyKey !== null} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:accept` ? 'Accepting…' : 'Accept order'}</button>
                  <button type="button" onClick={() => runOrderAction(order, 'decline')} disabled={busyKey !== null} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-zinc-700 disabled:opacity-50">{busyKey === `${order.id}:decline` ? 'Declining…' : 'Decline order'}</button>
                </>
              ) : null}
              {canConfirmReceipt ? <button type="button" onClick={() => runOrderAction(order, 'receipt')} disabled={busyKey !== null} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:receipt` ? 'Confirming…' : 'Confirm receipt'}</button> : null}
              {canDispute ? <button type="button" onClick={() => { setDisputeOrderId(disputeOrderId === order.id ? null : order.id); setFeedback(null); }} disabled={busyKey !== null} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-zinc-700 disabled:opacity-50">Report a problem / dispute</button> : null}
              <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)} aria-expanded={isExpanded} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-zinc-700">{isExpanded ? 'Hide transaction history' : 'View transaction history'}</button>
              {order.listing_id ? <Link href={`/listing/${order.listing_id}`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-zinc-700">View listing</Link> : null}
            </div>

            {!isBuying && sellerAccepted ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-zinc-400">After handover, the buyer confirms receipt in Orders. Your settlement status is shown here when recorded by the backend.</p> : null}

            {disputeOrderId === order.id ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                <h3 className="font-semibold">Dispute transaction</h3>
                <p className="mt-1 text-sm leading-5 text-amber-900 dark:text-amber-100">Only report a genuine issue. Opening a dispute pauses release while CampusTrader reviews it.</p>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm font-semibold" htmlFor={`dispute-reason-${order.id}`}>Reason
                    <select id={`dispute-reason-${order.id}`} value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                      {disputeReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold" htmlFor={`dispute-description-${order.id}`}>What happened?
                    <textarea id={`dispute-description-${order.id}`} value={disputeDescription} onChange={(event) => setDisputeDescription(event.target.value)} rows={3} maxLength={1200} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => submitDispute(order)} disabled={busyKey !== null} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:dispute` ? 'Submitting…' : 'Submit dispute'}</button>
                    <button type="button" onClick={() => setDisputeOrderId(null)} disabled={busyKey !== null} className="rounded-xl border border-amber-900/20 px-4 py-2.5 text-sm font-semibold text-amber-900 dark:text-amber-100">Cancel</button>
                  </div>
                </div>
              </div>
            ) : null}

            {isExpanded ? (
              <section className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800" aria-label={`Transaction history for ${order.order_number}`}>
                <h3 className="font-semibold">Transaction timeline</h3>
                {eventsLoading ? <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">Loading recorded events…</p> : null}
                {eventError ? <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-200">Recorded timeline is unavailable for this session.</p> : null}
                {!eventsLoading && !eventError && orderEvents.length === 0 ? <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">No transaction events have been recorded yet.</p> : null}
                {orderEvents.length > 0 ? (
                  <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4 dark:border-zinc-800">
                    {orderEvents.map((event) => (
                      <li key={event.id} className="relative text-sm">
                        <span className="absolute -left-[1.34rem] top-1.5 size-2 rounded-full bg-blue-500" aria-hidden="true" />
                        <p className="font-semibold">{prettyState(event.event_type)}</p>
                        {event.new_order_state ? <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Status: {prettyState(event.new_order_state)}</p> : null}
                        <time className="mt-1 block text-xs text-slate-500 dark:text-zinc-500">{new Date(event.created_at).toLocaleString('en-KE')}</time>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
