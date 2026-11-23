'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import useSWR from 'swr';
import useUser from '../hooks/useUser';
import { normalizeKenyanPhone } from '../lib/phoneValidation';
import {
  createMarketplaceOrder,
  getCheckoutConfig,
  getTransactionPayload,
  getTransactionResultError,
  type CheckoutConfig,
} from '../lib/orders';

type Props = { listingId: string; sellerId: string; listingPrice: number; listingCampus: string };
type CreatedOrder = { id: string; orderNumber: string; totalAmount: number | null };
type PaymentPreference = 'direct' | 'protected';

function formatKes(value: number) {
  return `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

export default function OrderCheckoutForm({ listingId, sellerId, listingPrice, listingCampus }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [paymentPreference, setPaymentPreference] = useState<PaymentPreference>('direct');
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'd_delivery'>('pickup');
  const [zoneCode, setZoneCode] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const orderKey = useRef<string | null>(null);
  const { user, loading: userLoading } = useUser();
  const { data: config, error: configError, isLoading: configLoading, mutate: retryConfig } = useSWR<CheckoutConfig>(
    user?.id ? 'campustrader-checkout-config' : null,
    async () => {
      const result = await getCheckoutConfig();
      if (result.error || !result.data) throw result.error || new Error('Configuration unavailable');
      return result.data;
    },
  );

  if (userLoading) return <section className="mt-5 rounded-2xl border border-[var(--border)] p-5 text-sm text-[var(--muted)] dark:border-[var(--border)] dark:text-[var(--muted)]">Checking your CampusTrader session…</section>;
  if (!user) return <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-5 text-sm leading-6 text-[var(--foreground)] dark:border-[var(--border)] dark:bg-[var(--brand-soft)] dark:text-[var(--foreground)]">Sign in to place an order. <Link href={`/signin?next=${encodeURIComponent(`/orders/new?listing=${listingId}`)}`} className="font-bold underline underline-offset-4">Sign in</Link></section>;
  if (user.id === sellerId) return <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-5 text-sm text-[var(--foreground)] dark:border-[var(--border)] dark:bg-[var(--brand-soft)] dark:text-[var(--foreground)]">You cannot order your own listing.</section>;
  if (configLoading) return <section className="mt-5 rounded-2xl border border-[var(--border)] p-5 text-sm text-[var(--muted)] dark:border-[var(--border)] dark:text-[var(--muted)]">Loading order options…</section>;
  if (configError || !config) return <section role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Order options are unavailable. <button type="button" onClick={() => void retryConfig()} className="ml-1 font-bold underline">Retry</button></section>;

  const selectedZone = config.delivery_zones.find((zone) => zone.zone_code === zoneCode);
  const subtotal = listingPrice * quantity;
  const protectionFee = paymentPreference === 'protected' ? subtotal * (config.platform_fee_percent / 100) : 0;
  const deliveryFee = deliveryOption === 'd_delivery' ? Number(selectedZone?.delivery_fee ?? 0) : 0;
  const canDeliver = config.delivery_enabled && config.delivery_zones.length > 0;
  // The database's NOT_CONFIGURED placeholder must never be displayed as a live escrow till.
  const protectedPaymentsReady = config.payment_initiation_available === true && Boolean(config.merchant_till_display.trim()) && !['NOT_CONFIGURED', 'COMING_SOON', 'TBD'].includes(config.merchant_till_display.trim().toUpperCase());

  function stableKey() { orderKey.current ??= crypto.randomUUID(); return orderKey.current; }
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus(null); setErrorMessage(null);
    const checkoutConfig = config;
    if (!checkoutConfig) return;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > checkoutConfig.max_quantity_per_order) {
      setErrorMessage(`Choose a whole-number quantity between 1 and ${checkoutConfig.max_quantity_per_order}.`); return;
    }
    if (paymentPreference === 'protected' && !protectedPaymentsReady) {
      setErrorMessage('Protected payment is temporarily unavailable. Choose direct payment or try again later.'); return;
    }
    if (deliveryOption === 'd_delivery' && (!canDeliver || !selectedZone || !receiverName.trim() || !normalizeKenyanPhone(receiverPhone) || !dropoff.trim())) {
      setErrorMessage('Choose a delivery zone and enter the receiver name, valid phone number and landmark.'); return;
    }
    setBusy(true);
    try {
      const result = await createMarketplaceOrder({
        listingId, quantity, deliveryOption, paymentPreference, campus: listingCampus,
        dropoffLocation: deliveryOption === 'd_delivery' ? [`Receiver: ${receiverName.trim()}`, `Receiver phone: ${normalizeKenyanPhone(receiverPhone)}`, `Location: ${dropoff.trim()}`, instructions.trim() ? `Instructions: ${instructions.trim()}` : ''].filter(Boolean).join('\n') : '',
        deliveryZoneCode: deliveryOption === 'd_delivery' ? zoneCode : '',
        buyerPhone: normalizeKenyanPhone(receiverPhone) || '',
        idempotencyKey: stableKey(),
      });
      const createError = getTransactionResultError(result.error, result.data, 'order');
      if (createError) { setErrorMessage(createError); return; }
      const payload = getTransactionPayload(result.data);
      const orderId = typeof payload.id === 'string' ? payload.id : typeof payload.order_id === 'string' ? payload.order_id : '';
      if (!orderId) { setErrorMessage('The backend did not return an order reference. Check Orders before retrying.'); return; }
      const returnedTotal = Number(payload.total_amount);
      const created = { id: orderId, orderNumber: typeof payload.order_number === 'string' ? payload.order_number : orderId.slice(0, 8).toUpperCase(), totalAmount: Number.isFinite(returnedTotal) ? returnedTotal : null };
      setOrder(created);
      setStatus(paymentPreference === 'protected' ? `Order ${created.orderNumber} requested. Payment instructions will appear after the seller accepts.` : deliveryOption === 'd_delivery' ? `Order ${created.orderNumber} requested. We’ll confirm delivery availability and timing with you.` : `Order ${created.orderNumber} requested. Arrange cash or M-Pesa with the seller after they accept.`);
    } catch { setErrorMessage('The order could not be created. Check Orders before retrying.'); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} onKeyDown={handleKeyDown} className="mt-5 space-y-4 rounded-2xl border border-[var(--border)] p-4 dark:border-[var(--border)] sm:p-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold" htmlFor="order-quantity">Quantity<input id="order-quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" min={1} max={config.max_quantity_per_order} step={1} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 dark:border-[var(--border)]" disabled={Boolean(order)} /></label>
      <div className="rounded-xl bg-[var(--background)] p-3 text-sm dark:bg-[var(--background)]">
        <p className="font-semibold">Estimated total</p>
        <p className="mt-1 text-lg font-bold text-[var(--brand)] dark:text-[var(--brand)]">{formatKes(subtotal + protectionFee + deliveryFee)}</p>
        <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)] dark:border-[var(--border)] dark:text-[var(--muted)]">
          <p className="flex justify-between gap-2"><span>Items</span><span>{formatKes(subtotal)}</span></p>
          {protectionFee > 0 ? <p className="flex justify-between gap-2"><span>Protected transaction fee</span><span>{formatKes(protectionFee)}</span></p> : null}
          {deliveryOption === 'pickup' ? <p className="flex justify-between gap-2"><span>Delivery</span><span>Pickup</span></p> : <p className="flex justify-between gap-2"><span>Delivery</span><span>{selectedZone ? formatKes(deliveryFee) : 'Choose a zone'}</span></p>}
        </div>
        
      </div>
    </div>

    <fieldset>
      <legend className="text-sm font-semibold">Payment</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className={`cursor-pointer rounded-xl border p-3 ${paymentPreference === 'direct' ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)]'}`}>
          <input className="sr-only" type="radio" name="payment" checked={paymentPreference === 'direct'} onChange={() => setPaymentPreference('direct')} disabled={Boolean(order)} />
          <span className="block text-sm font-semibold">Pay the seller directly</span>
          <span className="text-xs text-[var(--muted)]">Agree on cash or M-Pesa with the seller after they accept your order.</span>
        </label>
        {protectedPaymentsReady ? (
          <label className={`cursor-pointer rounded-xl border p-3 ${paymentPreference === 'protected' ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)]'}`}>
            <input className="sr-only" type="radio" name="payment" checked={paymentPreference === 'protected'} onChange={() => setPaymentPreference('protected')} disabled={Boolean(order)} />
            <span className="block text-sm font-semibold">CampusTrader protected payment</span>
            <span className="text-xs text-[var(--muted)]">Pay through the protected checkout.</span>
          </label>
        ) : null}
      </div>
    </fieldset>

    <fieldset>
      <legend className="text-sm font-semibold">Collection and delivery</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className={`cursor-pointer rounded-xl border p-3 ${deliveryOption === 'pickup' ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)]'}`}>
          <input className="sr-only" type="radio" name="fulfillment" checked={deliveryOption === 'pickup'} onChange={() => setDeliveryOption('pickup')} disabled={Boolean(order)} />
          <span className="block text-sm font-semibold">Campus pickup</span>
          <span className="text-xs text-[var(--muted)]">Arrange collection with the seller.</span>
        </label>
        {canDeliver ? (
          <label className={`cursor-pointer rounded-xl border p-3 ${deliveryOption === 'd_delivery' ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)]'}`}>
            <input className="sr-only" type="radio" name="fulfillment" checked={deliveryOption === 'd_delivery'} onChange={() => setDeliveryOption('d_delivery')} disabled={Boolean(order)} />
            <span className="block text-sm font-semibold">D-Delivery</span>
            <span className="text-xs text-[var(--muted)]">Request delivery to your campus location.</span>
          </label>
        ) : null}
      </div>
    </fieldset>

    {deliveryOption === 'd_delivery' ? <div className="space-y-3 rounded-xl bg-[var(--background)] p-3 dark:bg-[var(--background)]"><label className="block text-sm font-semibold" htmlFor="delivery-zone">Destination zone<select id="delivery-zone" value={zoneCode} onChange={(event) => setZoneCode(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 dark:border-[var(--border)]" disabled={Boolean(order)}><option value="">Choose a configured destination</option>{config.delivery_zones.map((zone) => <option key={zone.zone_code} value={zone.zone_code}>{zone.display_name} — {formatKes(Number(zone.delivery_fee))}</option>)}</select></label><label className="block text-sm font-semibold" htmlFor="delivery-receiver-name">Receiver name<input id="delivery-receiver-name" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 dark:border-[var(--border)]" disabled={Boolean(order)} /></label><label className="block text-sm font-semibold" htmlFor="delivery-receiver-phone">Receiver phone<input id="delivery-receiver-phone" value={receiverPhone} onChange={(event) => setReceiverPhone(event.target.value)} inputMode="tel" placeholder="0712345678" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 dark:border-[var(--border)]" disabled={Boolean(order)} /></label><label className="block text-sm font-semibold" htmlFor="delivery-location">Specific location / landmark<input id="delivery-location" value={dropoff} onChange={(event) => setDropoff(event.target.value)} placeholder="Hostel, apartment or landmark" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 dark:border-[var(--border)]" disabled={Boolean(order)} /></label><label className="block text-sm font-semibold" htmlFor="delivery-instructions">Instructions <span className="font-normal text-[var(--muted)]">(optional)</span><textarea id="delivery-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={2} className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 dark:border-[var(--border)]" disabled={Boolean(order)} /></label></div> : null}

    <div className="rounded-xl bg-[var(--background)] p-4 text-sm dark:bg-[var(--background)]"><div className="flex justify-between gap-4"><span>Item total</span><span>{formatKes(subtotal)}</span></div>{paymentPreference === 'protected' && protectionFee > 0 ? <div className="mt-2 flex justify-between gap-4"><span>Protected payment fee</span><span>{formatKes(protectionFee)}</span></div> : null}<div className="mt-2 flex justify-between gap-4"><span>Delivery estimate</span><span>{deliveryOption === 'd_delivery' ? selectedZone ? formatKes(deliveryFee) : 'Choose a zone' : 'Campus pickup'}</span></div></div>
    {status ? <p role="status" className="rounded-xl border border-[var(--border)] bg-[var(--brand-soft)] p-3 text-sm leading-6 text-[var(--foreground)] dark:border-[var(--border)] dark:bg-[var(--brand-soft)] dark:text-[var(--foreground)]">{status}</p> : null}{errorMessage ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">{errorMessage}</p> : null}
    <button type="submit" disabled={busy || Boolean(order)} className="w-full rounded-2xl bg-[var(--brand)] px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Placing order…' : order ? 'Order requested' : 'Confirm order request'}</button>{order ? <Link href="/orders" className="block text-center text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline dark:text-[var(--brand)]">Track order {order.orderNumber}</Link> : null}
  </form>;
}
