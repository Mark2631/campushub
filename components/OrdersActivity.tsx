'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import {
  cancelMarketplaceOrder,
  confirmOrderReceipt,
  getMyOrders,
  getBuyerDeliveryStatus,
  getOrderEvents,
  getOrderFulfillmentDetails,
  getOrderParticipantNames,
  getTransactionResultError,
  openOrderDispute,
  sellerAcceptOrder,
  sellerConfirmPickupHandover,
  sellerDeclineOrder,
  type MarketplaceOrder,
  type OrderEvent,
  type OrderFulfillmentDetails,
} from '../lib/orders';
import { createVerifiedPurchaseReview, getReviewsWrittenByBuyer } from '../lib/reviews';

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
  { value: 'PAYMENT_ISSUE', label: 'Payment issue' },
  { value: 'OTHER', label: 'Other' },
];

const normalizeState = (value?: string | null) => String(value || '').trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
const prettyState = (value?: string | null) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not available';
const prettyPaymentState = (value?: string | null) => {
  const state = normalizeState(value);
  if (['STK_REQUESTED', 'REQUEST_SENT'].includes(state)) return 'Payment request sent';
  if (['PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING'].includes(state)) return 'Payment pending';
  if (state === 'DIRECT_ARRANGED') return 'Direct payment · not verified by CampusTrader';
  if (['PAYMENT_SECURED', 'SECURED', 'PAID'].includes(state)) return 'Protected payment secured';
  if (['FAILED', 'PAYMENT_FAILED', 'STK_FAILED'].includes(state)) return 'Payment failed';
  if (['CANCELLED', 'PAYMENT_CANCELLED'].includes(state)) return 'Payment cancelled';
  if (['VERIFICATION_FAILED', 'PAYMENT_VERIFICATION_FAILED'].includes(state)) return 'Payment verification failed';
  if (state.includes('PAYMENT_RECEIVED') && state.includes('PENDING')) return 'Payment received · order confirmation pending';
  return prettyState(value);
};
const formatKes = (value: number) => `KSh ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

function orderIsDirect(order: MarketplaceOrder) {
  return normalizeState(order.payment_option) === 'DIRECT';
}

function orderIsPaid(order: MarketplaceOrder) {
  return ['PAYMENT_SECURED', 'SECURED', 'PAID'].includes(normalizeState(order.payment_state));
}

// Direct arrangements are not verified payments, but the backend permits the
// seller acceptance and buyer receipt steps for eligible direct orders.
function orderCanProgress(order: MarketplaceOrder) {
  return orderIsPaid(order)
    || (orderIsDirect(order) && normalizeState(order.payment_state) === 'DIRECT_ARRANGED');
}

function orderIsClosed(order: MarketplaceOrder) {
  return ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'SELLER_DECLINED', 'REFUND_PENDING'].includes(normalizeState(order.order_state));
}

export default function OrdersActivity({ userId, activeTab }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('ITEM_NOT_RECEIVED');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const cancellationKeys = useRef<Record<string, string>>({});

  const { data, error, isLoading, mutate } = useSWR(
    userId ? `campustrader-orders:${userId}` : null,
    async () => {
      const { data: rows, error: queryError } = await getMyOrders(userId);
      if (queryError) throw queryError;
      const orders = (rows || []) as MarketplaceOrder[];
      const profileIds = orders.flatMap((order) => [order.buyer_id, order.seller_id]);
      const { data: participantNames } = await getOrderParticipantNames(profileIds);
      return { orders, participantNames };
    },
    {
      revalidateOnFocus: true,
      refreshInterval: (latestData) => latestData?.orders.some((order) => ['STK_REQUESTED', 'PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING', 'PENDING_VERIFICATION'].includes(normalizeState(order.payment_state))) ? 8000 : 0,
    },
  );

  const {
    data: buyerReviews = [],
    error: buyerReviewsError,
    isLoading: buyerReviewsLoading,
    mutate: mutateBuyerReviews,
  } = useSWR(
    userId ? `campustrader-reviews-written:${userId}` : null,
    async () => {
      const result = await getReviewsWrittenByBuyer(userId);
      if (result.error) throw result.error;
      return result.reviews;
    },
    { revalidateOnFocus: true },
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
  const expandedOrder = orders.find((order) => order.id === expandedOrderId);
  const shouldLoadDirectDelivery = Boolean(
    activeTab === 'buying'
    && expandedOrder
    && expandedOrder.buyer_id === userId
    && orderIsDirect(expandedOrder)
    && normalizeState(expandedOrder.delivery_option) === 'D_DELIVERY'
    && !orderIsClosed(expandedOrder)
  );
  const directDeliveryKey = shouldLoadDirectDelivery && expandedOrderId
    ? ['campustrader-direct-delivery-status', expandedOrderId] as const
    : null;
  const {
    data: buyerDeliveryState,
    error: buyerDeliveryError,
    isLoading: buyerDeliveryLoading,
    mutate: mutateBuyerDelivery,
  } = useSWR(
    directDeliveryKey,
    async ([, orderId]) => {
      const result = await getBuyerDeliveryStatus(String(orderId), userId);
      if (result.error) throw result.error;
      return normalizeState(result.status);
    },
    { revalidateOnFocus: true, refreshInterval: directDeliveryKey ? 10000 : 0 },
  );
  const canReadFulfillmentDetails = Boolean(expandedOrder && (
    expandedOrder.buyer_id === userId
    || (expandedOrder.seller_id === userId && orderIsPaid(expandedOrder))
  ));
  const fulfillmentKey = expandedOrderId && canReadFulfillmentDetails
    ? ['campustrader-order-fulfillment', expandedOrderId] as const
    : null;
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

  async function runOrderAction(order: MarketplaceOrder, action: 'receipt' | 'accept' | 'decline' | 'handover') {
    if (action === 'receipt' && !window.confirm(orderIsDirect(order) ? normalizeState(order.delivery_option) === 'D_DELIVERY' ? 'Only confirm after the delivery has arrived and you have checked the item. CampusTrader does not verify direct payment. Continue?' : 'Only confirm after you have physically collected and checked the item. CampusTrader does not verify direct payment. Continue?' : 'Only confirm after you have received and checked your order. This confirmation cannot be undone. Continue?')) return;
    if (action === 'decline' && !window.confirm(orderIsDirect(order) ? 'Decline this direct-arranged order? CampusTrader has not received or verified payment. Agree any direct-payment resolution with the buyer outside CampusTrader.' : 'Declining sends the order to the backend refund workflow. A refund is not automatic. Continue?')) return;
    if (action === 'handover' && !window.confirm('Confirm only after you have physically handed the item to the buyer. This will be recorded in the transaction history. Continue?')) return;

    setBusyKey(`${order.id}:${action}`);
    setFeedback(null);
    try {
      const result = action === 'receipt'
        ? await confirmOrderReceipt(order.id)
        : action === 'accept'
          ? await sellerAcceptOrder(order.id)
          : action === 'decline'
            ? await sellerDeclineOrder(order.id, 'Seller is unable to fulfill this order.')
            : await sellerConfirmPickupHandover(order.id);
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) {
        setFeedback({ type: 'error', text: actionError });
      } else {
        const successText = action === 'receipt'
          ? orderIsDirect(order) ? normalizeState(order.delivery_option) === 'D_DELIVERY' ? 'Delivery receipt confirmed. Direct payment remains between you and the seller; CampusTrader has not verified it.' : 'Collection confirmed. Direct payment remains between you and the buyer; CampusTrader has not verified it.' : 'Receipt confirmed. The protected transaction is awaiting the configured settlement workflow.'
          : action === 'accept'
            ? orderIsDirect(order) ? 'Order accepted. Agree on direct payment and collection details with the buyer.' : 'Order accepted. Payment remains protected; prepare the item for handover.'
            : action === 'decline'
              ? orderIsDirect(order) ? 'Order declined before direct payment was verified by CampusTrader. Agree any outstanding arrangement directly with the buyer.' : 'Order declined. Refund handling remains subject to backend processing.'
              : 'Pickup handover recorded. The buyer can confirm receipt in Orders.';
        setFeedback({ type: 'success', text: successText });
      }
      await mutate();
      if (expandedOrderId === order.id) {
        await mutateEvents();
        await mutateBuyerDelivery();
      }
    } catch {
      setFeedback({ type: 'error', text: 'The transaction service could not complete that action. Refresh the order before retrying.' });
    } finally {
      setBusyKey(null);
    }
  }

  async function cancelUnpaidOrder(order: MarketplaceOrder) {
    if (!window.confirm(orderIsDirect(order) ? 'Cancel this order request before the seller accepts it? CampusTrader does not receive or verify any direct payment arranged outside the platform.' : 'Cancel this unpaid order? The backend will release its reserved stock if the order is still eligible.')) return;
    cancellationKeys.current[order.id] ??= crypto.randomUUID();
    setBusyKey(`${order.id}:cancel`);
    setFeedback(null);
    try {
      const result = await cancelMarketplaceOrder(order.id, cancellationKeys.current[order.id]);
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) {
        setFeedback({ type: 'error', text: actionError });
      } else {
        setFeedback({ type: 'success', text: 'Order cancellation was recorded by the backend. No payment or refund is assumed.' });
      }
      await mutate();
      if (expandedOrderId === order.id) {
        await mutateEvents();
        await mutateBuyerDelivery();
      }
    } catch {
      setFeedback({ type: 'error', text: 'Cancellation could not be confirmed. Refresh Orders before retrying; the backend remains authoritative.' });
    } finally {
      setBusyKey(null);
    }
  }

  async function submitReview(order: MarketplaceOrder) {
    if (
      order.buyer_id !== userId
      || !orderCanProgress(order)
      || normalizeState(order.order_state) !== 'COMPLETED'
      || normalizeState(order.buyer_receipt_state) !== 'CONFIRMED'
      || !order.listing_id
      || !order.seller_id
    ) {
      setFeedback({ type: 'error', text: 'Reviews are available only after you confirm receipt of a completed order.' });
      return;
    }

    setBusyKey(`${order.id}:review`);
    setFeedback(null);
    try {
      const result = await createVerifiedPurchaseReview({
        reviewerId: userId,
        sellerId: order.seller_id,
        listingId: order.listing_id,
        rating: reviewRating,
        comment: reviewComment,
      });
      if (result.error) {
        setFeedback({ type: 'error', text: result.error });
        return;
      }

      setReviewOrderId(null);
      setReviewRating(5);
      setReviewComment('');
      setFeedback({ type: 'success', text: 'Thank you. Your verified-purchase feedback has been saved.' });
      await mutateBuyerReviews();
    } catch {
      setFeedback({ type: 'error', text: 'Your review could not be saved. Refresh the order and try again.' });
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
    return <section className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--muted)]">Loading your protected orders…</section>;
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
      {feedback ? <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-4 text-sm leading-6 ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100' : 'border-[var(--border)] bg-[var(--brand-soft)] text-[var(--foreground)] dark:border-[var(--border)] dark:bg-[var(--brand-soft)] dark:text-[var(--foreground)]'}`}>{feedback.text}</p> : null}

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-[var(--surface)] p-8 text-center dark:border-[var(--border)] dark:bg-[var(--surface)]">
          <p className="font-semibold">{activeTab === 'buying' ? 'No purchases yet.' : 'No sales yet.'}</p>
          <p className="mt-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">Orders appear here only after the backend creates them.</p>
          {activeTab === 'buying' ? <Link href="/" className="mt-4 inline-flex rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Browse listings</Link> : null}
        </div>
      ) : null}

      {orders.map((order) => {
        const orderState = normalizeState(order.order_state);
        const sellerState = normalizeState(order.seller_acceptance_state);
        const isBuying = activeTab === 'buying';
        const sellerPending = ['SELLER_PENDING', 'PENDING', 'WAITING', 'NOT_STARTED'].includes(sellerState)
          || (!sellerState && ['SELLER_PENDING', 'AWAITING_SELLER', 'PAYMENT_SECURED'].includes(orderState));
        const sellerAccepted = ['ACCEPTED', 'SELLER_ACCEPTED'].includes(sellerState) || orderState === 'SELLER_ACCEPTED';
        const canSellerRespond = !isBuying && orderCanProgress(order) && sellerPending && !orderIsClosed(order) && orderState !== 'DISPUTED';
        const deliveryOption = normalizeState(order.delivery_option);
        const isSelfPickup = ['PICKUP', 'SELF_PICKUP'].includes(deliveryOption);
        const canSellerConfirmHandover = !isBuying && isSelfPickup && orderIsPaid(order) && sellerAccepted
          && ['AWAITING_HANDOVER', 'SELLER_ACCEPTED', 'HANDED_OVER'].includes(orderState)
          && !orderIsClosed(order) && orderState !== 'DISPUTED';
        const buyerReceiptState = normalizeState(order.buyer_receipt_state);
        const directPickupReady = orderIsDirect(order)
          && isSelfPickup
          && ['SELLER_ACCEPTED', 'AWAITING_RECEIPT'].includes(orderState);
        const directDeliveryReady = orderIsDirect(order)
          && !isSelfPickup
          && ['ARRIVED', 'DELIVERED'].includes(expandedOrderId === order.id ? buyerDeliveryState || '' : '')
          && ['SELLER_ACCEPTED', 'OUT_FOR_DELIVERY', 'AWAITING_RECEIPT'].includes(orderState);
        const protectedReceiptReady = orderIsPaid(order)
          && ['DELIVERED', 'AWAITING_CONFIRMATION', 'AWAITING_RECEIPT', 'HANDED_OVER', 'RECEIPT_CONFIRMED'].includes(orderState);
        const canConfirmReceipt = isBuying
          && (directPickupReady || directDeliveryReady || protectedReceiptReady)
          && !['CONFIRMED', 'BUYER_CONFIRMED', 'RECEIVED'].includes(buyerReceiptState)
          && orderState !== 'DISPUTED';
        const paymentState = normalizeState(order.payment_state);
        const canCancelDirectRequest = isBuying
          && orderIsDirect(order)
          && paymentState === 'DIRECT_ARRANGED'
          && orderState === 'CREATED';
        const canCancelUnpaidProtected = isBuying && !orderIsDirect(order) && !orderIsPaid(order)
          && ['', 'NOT_STARTED', 'FAILED', 'PAYMENT_FAILED', 'CANCELLED', 'PAYMENT_CANCELLED', 'TIMED_OUT'].includes(paymentState);
        const canCancel = (canCancelDirectRequest || canCancelUnpaidProtected)
          && !orderIsClosed(order) && orderState !== 'DISPUTED';
        const canDispute = isBuying && !orderIsClosed(order) && orderState !== 'DISPUTED';
        const nameId = isBuying ? order.seller_id : order.buyer_id;
        const personName = participantNames[nameId] || (isBuying ? 'Seller' : 'Buyer');
        const fee = Number(order.platform_fee_amount || 0);
        const deliveryFee = Number(order.delivery_fee_snapshot || 0);
        const productAmount = order.item_subtotal != null && Number.isFinite(Number(order.item_subtotal))
          ? Number(order.item_subtotal)
          : Math.max(0, Number(order.total_amount || 0) - fee - deliveryFee);
        const isExpanded = expandedOrderId === order.id;
        const orderEvents = isExpanded ? events || [] : [];
        const completedReceipt = isBuying
          && orderCanProgress(order)
          && orderState !== 'DISPUTED'
          && orderState === 'COMPLETED'
          && buyerReceiptState === 'CONFIRMED';
        const existingReview = buyerReviews.find((review) =>
          review.seller_id === order.seller_id && review.listing_id === order.listing_id
        );

        return (
          <article key={order.id} id={isBuying ? 'buying' : 'selling'} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 dark:border-[var(--border)] dark:bg-[var(--surface)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)] dark:text-[var(--brand)]">{order.order_number || order.id}</p>
                <h2 className="mt-2 font-bold">{order.listing_title_snapshot || 'CampusTrader order'}</h2>
                <p className="mt-1 text-sm text-[var(--muted)] dark:text-[var(--muted)]">{isBuying ? 'Seller' : 'Buyer'}: {personName}</p>
                <p className="mt-1 text-xs text-[var(--muted)] dark:text-[var(--muted)]">{new Date(order.created_at).toLocaleString('en-KE')}</p>
              </div>
              <p className="font-bold">{formatKes(Number(order.total_amount))}</p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-[var(--background)] p-4 text-sm dark:bg-[var(--background)] sm:grid-cols-3">
              <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Quantity</dt><dd className="mt-1 font-semibold">{order.quantity}</dd></div>
              <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Fulfilment</dt><dd className="mt-1 font-semibold">{prettyState(order.delivery_option)}</dd></div>
              <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Payment</dt><dd className="mt-1 font-semibold">{orderIsDirect(order) ? 'Direct · not verified' : prettyPaymentState(order.payment_state)}</dd></div>
              <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Order status</dt><dd className="mt-1 font-semibold">{prettyState(order.order_state)}</dd></div>
              <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Product amount</dt><dd className="mt-1 font-semibold">{formatKes(productAmount)}</dd></div>
                <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Platform + delivery fees</dt><dd className="mt-1 font-semibold">{formatKes(fee + deliveryFee)}</dd></div>
                {order.expires_at && ['PENDING_PAYMENT', 'PAYMENT_PENDING', 'SELLER_PENDING'].includes(orderState) ? <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Order expires</dt><dd className="mt-1 font-semibold">{new Date(order.expires_at).toLocaleString('en-KE')}</dd></div> : null}
              </dl>

            {completedReceipt ? (
              <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4" aria-label="Seller feedback">
                {existingReview ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">You already reviewed this seller for this item.</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Verified purchase · {existingReview.comment ? existingReview.comment : 'Rating submitted without a comment.'}</p>
                    </div>
                    <div className="flex items-center gap-1" aria-label={`${existingReview.rating} out of 5 stars`}>
                      <Star className="h-4 w-4 fill-current text-amber-500" />
                      <span className="text-sm font-bold">{existingReview.rating}/5</span>
                    </div>
                  </div>
                ) : buyerReviewsLoading ? (
                  <p className="text-sm text-[var(--muted)]">Checking your review history…</p>
                ) : buyerReviewsError ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[var(--muted)]">Your review history could not be checked.</p>
                    <button type="button" onClick={() => mutateBuyerReviews()} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold">Retry</button>
                  </div>
                ) : reviewOrderId === order.id ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold">How was this purchase?</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Rate the seller based on the item, communication and handover.</p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label="Choose seller rating">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-label={`${value} star${value === 1 ? '' : 's'}`}
                          aria-pressed={reviewRating === value}
                          onClick={() => setReviewRating(value)}
                          className="rounded-lg p-2 transition hover:bg-[var(--surface)]"
                        >
                          <Star className={`h-6 w-6 ${value <= reviewRating ? 'fill-amber-400 text-amber-500' : 'text-[var(--muted)]'}`} />
                        </button>
                      ))}
                      <span className="ml-2 text-sm font-semibold">{reviewRating}/5</span>
                    </div>
                    <label className="block text-sm font-medium" htmlFor={`seller-review-${order.id}`}>Share how the purchase went <span className="font-normal text-[var(--muted)]">(optional)</span></label>
                    <textarea
                      id={`seller-review-${order.id}`}
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value.slice(0, 600))}
                      rows={3}
                      maxLength={600}
                      placeholder="Was the item as described? Was communication and handover clear?"
                      className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-[var(--muted)]">{reviewComment.length}/600</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setReviewOrderId(null)} disabled={busyKey !== null} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold">Cancel</button>
                        <button type="button" onClick={() => submitReview(order)} disabled={busyKey !== null} className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:review` ? 'Saving…' : 'Submit review'}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Purchase completed</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Share how the order went. Your feedback is saved on the seller’s account.</p>
                    </div>
                    <button type="button" onClick={() => { setReviewOrderId(order.id); setReviewRating(5); setReviewComment(''); }} className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Rate seller</button>
                  </div>
                )}
              </section>
            ) : null}

            {isBuying && orderState === 'DISPUTED' ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">Transaction under review. It cannot be released while this dispute is active.</p> : null}
            {!isBuying && orderIsDirect(order) && !orderIsClosed(order) ? (
              <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)]">
                Direct payment is arranged between you and the buyer. CampusTrader does not receive or verify it. Agree on the payment and collection details before handover.
              </p>
            ) : null}
            {isBuying && orderIsDirect(order) && !orderIsClosed(order) ? (
              <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)]">
                Direct payment is arranged with the seller. CampusTrader does not receive or verify it. Confirm receipt only after you have physically collected the item.
              </p>
            ) : null}
            {!isBuying && orderIsPaid(order) ? (
              <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--brand-soft)] p-3 text-sm leading-6 text-[var(--foreground)] dark:border-[var(--border)] dark:bg-[var(--brand-soft)] dark:text-[var(--foreground)]">
                Protected payment secured. {sellerAccepted ? 'Order accepted; please prepare the item.' : sellerPending ? 'Waiting for your response.' : prettyState(order.seller_acceptance_state)} Settlement is operator-managed after handover and buyer confirmation; no automatic payout is promised.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {!isBuying && canSellerRespond ? (
                <>
                  <button type="button" onClick={() => runOrderAction(order, 'accept')} disabled={busyKey !== null} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:accept` ? 'Accepting…' : 'Accept order'}</button>
                  <button type="button" onClick={() => runOrderAction(order, 'decline')} disabled={busyKey !== null} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold dark:border-[var(--border)] disabled:opacity-50">{busyKey === `${order.id}:decline` ? 'Declining…' : 'Decline order'}</button>
                </>
              ) : null}
              {canSellerConfirmHandover ? <button type="button" onClick={() => runOrderAction(order, 'handover')} disabled={busyKey !== null} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:handover` ? 'Recording handover…' : 'Confirm pickup handover'}</button> : null}
              {canConfirmReceipt ? <button type="button" onClick={() => runOrderAction(order, 'receipt')} disabled={busyKey !== null} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:receipt` ? 'Confirming…' : orderIsDirect(order) ? isSelfPickup ? 'Confirm collection' : 'Confirm delivery received' : 'Confirm receipt'}</button> : null}
              {canCancel ? <button type="button" onClick={() => cancelUnpaidOrder(order)} disabled={busyKey !== null} className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-800 disabled:opacity-50 dark:border-amber-900/60 dark:text-amber-200">{busyKey === `${order.id}:cancel` ? 'Cancelling…' : orderIsDirect(order) ? 'Cancel order request' : 'Cancel unpaid order'}</button> : null}
              {canDispute ? <button type="button" onClick={() => { setDisputeOrderId(disputeOrderId === order.id ? null : order.id); setFeedback(null); }} disabled={busyKey !== null} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold dark:border-[var(--border)] disabled:opacity-50">Report a problem / dispute</button> : null}
              <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)} aria-expanded={isExpanded} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold dark:border-[var(--border)]">{isExpanded ? 'Hide order details' : 'View order details'}</button>
              {order.listing_id ? <Link href={`/listing/${order.listing_id}`} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold dark:border-[var(--border)]">View listing</Link> : null}
            </div>

            {isBuying && orderIsDirect(order) && !isSelfPickup && isExpanded ? (
              <p className="mt-3 text-xs leading-5 text-[var(--muted)] dark:text-[var(--muted)]">
                {buyerDeliveryLoading ? 'Checking delivery status…' : buyerDeliveryError ? 'Delivery status is unavailable. Refresh Orders before confirming receipt.' : buyerDeliveryState ? `Delivery status: ${prettyState(buyerDeliveryState)}. Receipt confirmation appears after the backend records arrival.` : 'Waiting for the delivery record. Confirm receipt only after the item has arrived and you have checked it.'}
              </p>
            ) : null}
            {!isBuying && sellerAccepted ? <p className="mt-3 text-xs leading-5 text-[var(--muted)] dark:text-[var(--muted)]">
              {orderIsDirect(order)
                ? isSelfPickup ? 'Direct payment is arranged with the buyer. Confirm collection details before handover; the buyer confirms collection in Orders.' : 'Direct D-Delivery is coordinated manually. CampusTrader does not verify direct payment or simulate rider dispatch.'
                : isSelfPickup ? 'Confirm pickup handover only after the buyer has collected the item. The buyer then confirms receipt in Orders.' : 'CampusTrader coordinates the delivery handoff. The backend records delivery status; no rider dispatch is simulated here.'}
            </p> : null}

            {disputeOrderId === order.id ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                <h3 className="font-semibold">Dispute transaction</h3>
                <p className="mt-1 text-sm leading-5 text-amber-900 dark:text-amber-100">Only report a genuine issue. Opening a dispute pauses release while CampusTrader reviews it.</p>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm font-semibold" htmlFor={`dispute-reason-${order.id}`}>Reason
                    <select id={`dispute-reason-${order.id}`} value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 dark:border-[var(--border)] dark:bg-[var(--surface)]">
                      {disputeReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold" htmlFor={`dispute-description-${order.id}`}>What happened?
                    <textarea id={`dispute-description-${order.id}`} value={disputeDescription} onChange={(event) => setDisputeDescription(event.target.value)} rows={3} maxLength={1200} className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 dark:border-[var(--border)] dark:bg-[var(--surface)]" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => submitDispute(order)} disabled={busyKey !== null} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyKey === `${order.id}:dispute` ? 'Submitting…' : 'Submit dispute'}</button>
                    <button type="button" onClick={() => setDisputeOrderId(null)} disabled={busyKey !== null} className="rounded-xl border border-amber-900/20 px-4 py-2.5 text-sm font-semibold text-amber-900 dark:text-amber-100">Cancel</button>
                  </div>
                </div>
              </div>
            ) : null}

            {isExpanded ? (
              <div className="mt-4 space-y-4">
                <section className="rounded-2xl border border-[var(--border)] p-4 dark:border-[var(--border)]" aria-label={`Fulfillment details for ${order.order_number}`}>
                  <h3 className="font-semibold">Fulfillment details</h3>
                  {!canReadFulfillmentDetails ? <p className="mt-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">Private fulfillment details are available to the buyer and to the seller after payment is secured.</p> : null}
                  {canReadFulfillmentDetails && fulfillmentLoading ? <p className="mt-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">Loading private fulfillment details…</p> : null}
                  {canReadFulfillmentDetails && fulfillmentError ? <p role="status" className="mt-2 text-sm text-amber-700 dark:text-amber-200">Private fulfillment details are unavailable for this session. No extra contact information is shown.</p> : null}
                  {canReadFulfillmentDetails && !fulfillmentLoading && !fulfillmentError && fulfillmentDetails ? (
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      {fulfillmentDetails.delivery_zone_code ? <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Delivery zone</dt><dd className="mt-1 font-medium">{prettyState(fulfillmentDetails.delivery_zone_code)}</dd></div> : null}
                      {fulfillmentDetails.pickup_location ? <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Pickup location</dt><dd className="mt-1 font-medium">{fulfillmentDetails.pickup_location}</dd></div> : null}
                      {fulfillmentDetails.dropoff_location ? <div className="sm:col-span-2"><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Delivery location and instructions</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{fulfillmentDetails.dropoff_location}</dd></div> : null}
                      {fulfillmentDetails.receiver_name ? <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Receiver</dt><dd className="mt-1 font-medium">{fulfillmentDetails.receiver_name}</dd></div> : null}
                      {fulfillmentDetails.receiver_phone ? <div><dt className="text-xs text-[var(--muted)] dark:text-[var(--muted)]">Receiver phone</dt><dd className="mt-1 font-medium">{fulfillmentDetails.receiver_phone}</dd></div> : null}
                    </dl>
                  ) : null}
                  {canReadFulfillmentDetails && !fulfillmentLoading && !fulfillmentError && !fulfillmentDetails?.delivery_zone_code && !fulfillmentDetails?.pickup_location && !fulfillmentDetails?.dropoff_location && !fulfillmentDetails?.receiver_name && !fulfillmentDetails?.receiver_phone ? <p className="mt-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">No additional fulfillment details are available for this order.</p> : null}
                </section>

                <section className="rounded-2xl border border-[var(--border)] p-4 dark:border-[var(--border)]" aria-label={`Transaction history for ${order.order_number}`}>
                  <h3 className="font-semibold">Transaction timeline</h3>
                {eventsLoading ? <p className="mt-3 text-sm text-[var(--muted)] dark:text-[var(--muted)]">Loading recorded events…</p> : null}
                {eventError ? <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-200">Recorded timeline is unavailable for this session.</p> : null}
                {!eventsLoading && !eventError && orderEvents.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)] dark:text-[var(--muted)]">No transaction events have been recorded yet.</p> : null}
                {orderEvents.length > 0 ? (
                  <ol className="mt-3 space-y-3 border-l border-[var(--border)] pl-4 dark:border-[var(--border)]">
                    {orderEvents.map((event) => (
                      <li key={event.id} className="relative text-sm">
                        <span className="absolute -left-[1.34rem] top-1.5 size-2 rounded-full bg-[var(--brand-soft)]0" aria-hidden="true" />
                        <p className="font-semibold">{prettyState(event.event_type)}</p>
                        {event.new_order_state ? <p className="mt-1 text-xs text-[var(--muted)] dark:text-[var(--muted)]">Status: {prettyState(event.new_order_state)}</p> : null}
                        <time className="mt-1 block text-xs text-[var(--muted)] dark:text-[var(--muted)]">{new Date(event.created_at).toLocaleString('en-KE')}</time>
                      </li>
                    ))}
                  </ol>
                ) : null}
                </section>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
