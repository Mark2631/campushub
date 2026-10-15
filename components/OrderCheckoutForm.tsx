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

  if (userLoading) return <section className="mt-5 rounded-2xl border border-slate-200 p-5 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">Checking your CampusTrader session…</section>;
  if (!user) return <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">Sign in to place an order. <Link href={`/signin?next=${encodeURIComponent(`/orders/new?listing=${listingId}`)}`} className="font-bold underline underline-offset-4">Sign in</Link></section>;
  if (user.id === sellerId) return <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">You cannot order your own listing.</section>;
  if (configLoading) return <section className="mt-5 rounded-2xl border border-slate-200 p-5 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">Loading order options…</section>;
  if (configError || !config) return <section role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Order options are unavailable. <button type="button" onClick={() => void retryConfig()} className="ml-1 font-bold underline">Retry</button></section>;

  const selectedZone = config.delivery_zones.find((zone) => zone.zone_code === zoneCode);
  const subtotal = listingPrice * quantity;
  const protectionFee = paymentPreference === 'protected' ? subtotal * (config.platform_fee_percent / 100) : 0;
  const deliveryFee = deliveryOption === 'd_delivery' ? Number(selectedZone?.delivery_fee ?? 0) : 0;
  const canDeliver = config.delivery_enabled && config.delivery_zones.length > 0;
  // The database's NOT_CONFIGURED placeholder must never be displayed as a live escrow till.
  const protectedPaymentsReady = Boolean(config.merchant_till_display.trim()) && !['NOT_CONFIGURED', 'COMING_SOON', 'TBD'].includes(config.merchant_till_display.trim().toUpperCase());

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
      setStatus(paymentPreference === 'protected' ? `Order ${created.orderNumber} requested. Payment instructions will appear after the seller accepts.` : `Order ${created.orderNumber} requested. Arrange payment directly with the seller after they accept.`);
    } catch { setErrorMessage('The order could not be created. Check Orders before retrying.'); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} onKeyDown={handleKeyDown} className="mt-5 space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 sm:p-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold" htmlFor="order-quantity">Quantity<input id="order-quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" min={1} max={config.max_quantity_per_order} step={1} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} /></label>
      <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-zinc-950"><p className="font-semibold">Item total</p><p className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-300">{formatKes(subtotal)}</p></div>
    </div>

    <fieldset><legend className="text-sm font-semibold">How would you like to transact?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className={`cursor-pointer rounded-xl border p-3 ${paymentPreference === 'direct' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'}`}><input className="sr-only" type="radio" name="payment" checked={paymentPreference === 'direct'} onChange={() => setPaymentPreference('direct')} disabled={Boolean(order)} /><span className="block text-sm font-semibold">Pay the seller directly</span><span className="text-xs text-slate-500 dark:text-zinc-400">Arrange cash or direct M-PESA yourself. CampusTrader does not verify or protect it.</span></label>
      <label className={`rounded-xl border p-3 ${protectedPaymentsReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${paymentPreference === 'protected' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'}`}><input className="sr-only" type="radio" name="payment" checked={paymentPreference === 'protected'} onChange={() => setPaymentPreference('protected')} disabled={!protectedPaymentsReady || Boolean(order)} /><span className="block text-sm font-semibold">CampusTrader protected payment</span><span className="text-xs text-slate-500 dark:text-zinc-400">Coming soon. Available only after the CampusTrader payment till and verification workflow are configured.</span></label>
    </div>{!protectedPaymentsReady ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Protected payment is temporarily unavailable until payment instructions are configured. Direct orders remain available.</p> : null}</fieldset>

    <fieldset><legend className="text-sm font-semibold">How will you get the item?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-3 ${deliveryOption === 'pickup' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'}`}><input className="sr-only" type="radio" name="fulfillment" checked={deliveryOption === 'pickup'} onChange={() => setDeliveryOption('pickup')} disabled={Boolean(order)} /><span className="block text-sm font-semibold">I’ll pick it up</span><span className="text-xs text-slate-500 dark:text-zinc-400">KSh 0</span></label><label className={`rounded-xl border p-3 ${canDeliver ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${deliveryOption === 'd_delivery' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'}`}><input className="sr-only" type="radio" name="fulfillment" checked={deliveryOption === 'd_delivery'} onChange={() => setDeliveryOption('d_delivery')} disabled={!canDeliver || Boolean(order)} /><span className="block text-sm font-semibold">D-Delivery</span><span className="text-xs text-slate-500 dark:text-zinc-400">Paid directly to the rider after delivery.</span></label></div></fieldset>

    {deliveryOption === 'd_delivery' ? <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-zinc-950"><label className="block text-sm font-semibold" htmlFor="delivery-zone">Destination zone<select id="delivery-zone" value={zoneCode} onChange={(event) => setZoneCode(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)}><option value="">Choose a configured destination</option>{config.delivery_zones.map((zone) => <option key={zone.zone_code} value={zone.zone_code}>{zone.display_name} — {formatKes(Number(zone.delivery_fee))}</option>)}</select></label><label className="block text-sm font-semibold" htmlFor="delivery-receiver-name">Receiver name<input id="delivery-receiver-name" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} /></label><label className="block text-sm font-semibold" htmlFor="delivery-receiver-phone">Receiver phone<input id="delivery-receiver-phone" value={receiverPhone} onChange={(event) => setReceiverPhone(event.target.value)} inputMode="tel" placeholder="0712345678" className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} /></label><label className="block text-sm font-semibold" htmlFor="delivery-location">Specific location / landmark<input id="delivery-location" value={dropoff} onChange={(event) => setDropoff(event.target.value)} placeholder="Hostel, apartment or landmark" className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} /></label><label className="block text-sm font-semibold" htmlFor="delivery-instructions">Instructions <span className="font-normal text-slate-500">(optional)</span><textarea id="delivery-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={2} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} /></label></div> : null}

    <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-zinc-950"><div className="flex justify-between gap-4"><span>Item total</span><span>{formatKes(subtotal)}</span></div><div className="mt-2 flex justify-between gap-4"><span>Protection fee</span><span>{paymentPreference === 'protected' ? formatKes(protectionFee) : 'None'}</span></div><div className="mt-2 flex justify-between gap-4"><span>D-Delivery</span><span>{deliveryOption === 'd_delivery' ? 'Paid to rider' : 'Free pickup'}</span></div></div>
    {status ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">{status}</p> : null}{errorMessage ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">{errorMessage}</p> : null}
    <button type="submit" disabled={busy || Boolean(order)} className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Placing order…' : order ? 'Order requested' : 'Confirm order request'}</button>{order ? <Link href="/orders" className="block text-center text-sm font-semibold text-blue-600 underline-offset-4 hover:underline dark:text-blue-300">Track order {order.orderNumber}</Link> : null}
  </form>;
}
