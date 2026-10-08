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
  requestOrderPayment,
  type CheckoutConfig,
} from '../lib/orders';

type Props = {
  listingId: string;
  sellerId: string;
  listingPrice: number;
  listingCampus: string;
};

type CreatedOrder = { id: string; orderNumber: string; totalAmount: number | null };

function formatKes(value: number) {
  return `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

export default function OrderCheckoutForm({ listingId, sellerId, listingPrice, listingCampus }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState('');
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'd_delivery'>('pickup');
  const [zoneCode, setZoneCode] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [paymentRequested, setPaymentRequested] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const orderKey = useRef<string | null>(null);
  const paymentKey = useRef<string | null>(null);
  const { user, loading: userLoading } = useUser();
  const {
    data: config,
    error: configError,
    isLoading: configLoading,
    mutate: retryConfig,
  } = useSWR<CheckoutConfig>(
    user?.id ? 'campustrader-checkout-config' : null,
    async () => {
      const result = await getCheckoutConfig();
      if (result.error || !result.data) throw result.error || new Error('Checkout configuration unavailable');
      return result.data;
    },
    { revalidateOnFocus: true },
  );

  if (userLoading) return <section className="mt-5 rounded-2xl border border-slate-200 p-5 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">Checking your CampusTrader session…</section>;
  if (!user) return <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">Sign in to continue with checkout. <Link href={`/signin?next=${encodeURIComponent(`/orders/new?listing=${listingId}`)}`} className="font-bold underline underline-offset-4">Sign in</Link></section>;
  if (user.id === sellerId) return <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">You cannot place an order for your own listing. Return to the listing to manage it.</section>;
  if (configLoading) return <section className="mt-5 rounded-2xl border border-slate-200 p-5 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">Loading current fee and delivery configuration…</section>;
  if (configError || !config) return <section role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Checkout configuration is unavailable. No order or payment request was submitted. <button type="button" onClick={() => void retryConfig()} className="ml-1 font-bold underline underline-offset-4">Retry</button></section>;

  const selectedZone = config.delivery_zones.find((zone) => zone.zone_code === zoneCode);
  const subtotal = listingPrice * quantity;
  const platformFee = subtotal * (config.platform_fee_percent / 100);
  const deliveryFee = deliveryOption === 'd_delivery' ? Number(selectedZone?.delivery_fee ?? 0) : 0;
  const estimatedTotal = subtotal + platformFee + deliveryFee;
  const canDeliver = config.delivery_enabled && config.delivery_zones.length > 0;

  function getStableKey(key: { current: string | null }) {
    key.current ??= crypto.randomUUID();
    return key.current;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) {
      event.preventDefault();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setErrorMessage(null);
    const checkoutConfig = config;
    if (!checkoutConfig) {
      setErrorMessage('Checkout configuration is unavailable. No order or payment request was submitted.');
      return;
    }

    if (!checkoutConfig.payment_initiation_available) {
      setErrorMessage('M-PESA payment setup is not ready yet. No order or payment request was submitted. Try again later or contact CampusTrader support.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > checkoutConfig.max_quantity_per_order) {
      setErrorMessage(`Choose a whole-number quantity between 1 and ${checkoutConfig.max_quantity_per_order}.`);
      return;
    }

    const normalizedBuyerPhone = normalizeKenyanPhone(phone);
    if (!normalizedBuyerPhone) {
      setErrorMessage('Enter a valid Kenyan M-PESA phone number, such as 0712345678.');
      return;
    }

    if (deliveryOption === 'd_delivery') {
      if (!canDeliver) {
        setErrorMessage('D-Delivery is not available until the backend has configured pilot zones and prices. Choose self pickup instead.');
        return;
      }
      if (!selectedZone || !receiverName.trim() || !normalizeKenyanPhone(receiverPhone) || !dropoff.trim()) {
        setErrorMessage('Choose a configured destination and enter the receiver name, a valid phone number, and a specific location.');
        return;
      }
    }

    setBusy(true);
    try {
      let activeOrder = order;

      if (!activeOrder) {
        const result = await createMarketplaceOrder({
          listingId,
          quantity,
          deliveryOption,
          campus: listingCampus,
          dropoffLocation: deliveryOption === 'd_delivery'
            ? [
                `Receiver: ${receiverName.trim()}`,
                `Receiver phone: ${normalizeKenyanPhone(receiverPhone)}`,
                `Location: ${dropoff.trim()}`,
                instructions.trim() ? `Instructions: ${instructions.trim()}` : '',
              ].filter(Boolean).join('\n')
            : '',
          deliveryZoneCode: deliveryOption === 'd_delivery' ? zoneCode : '',
          buyerPhone: normalizedBuyerPhone,
          idempotencyKey: getStableKey(orderKey),
        });
        const createError = getTransactionResultError(result.error, result.data, 'order');
        if (createError) {
          setErrorMessage(createError);
          return;
        }

        const payload = getTransactionPayload(result.data);
        const orderId = typeof payload.id === 'string' ? payload.id : typeof payload.order_id === 'string' ? payload.order_id : '';
        if (!orderId) {
          setErrorMessage('The backend did not return an order reference. Check Orders before retrying; no payment is considered secured.');
          return;
        }
        const returnedTotal = Number(payload.total_amount);
        activeOrder = {
          id: orderId,
          orderNumber: typeof payload.order_number === 'string' ? payload.order_number : orderId.slice(0, 8).toUpperCase(),
          totalAmount: Number.isFinite(returnedTotal) ? returnedTotal : null,
        };
        setOrder(activeOrder);
      }

      const paymentResult = await requestOrderPayment(
        activeOrder.id,
        normalizedBuyerPhone,
        getStableKey(paymentKey),
      );
      const paymentError = getTransactionResultError(paymentResult.error, paymentResult.data, 'payment');
      if (paymentError) {
        setErrorMessage(paymentError);
        return;
      }

      setPaymentRequested(true);
      const confirmedTotal = activeOrder.totalAmount === null ? 'The backend total will appear in Orders.' : `Backend-confirmed total: ${formatKes(activeOrder.totalAmount)}.`;
      setStatus(`M-PESA request sent for order ${activeOrder.orderNumber}. ${confirmedTotal} Complete the prompt on your phone, then wait for verified server confirmation. The order will not show as paid until the callback is verified.`);
    } catch {
      setErrorMessage('The request could not reach the transaction service. Check Orders before retrying so you do not create a duplicate order.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} onKeyDown={handleKeyDown} className="mt-5 space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold" htmlFor="order-quantity">
          Quantity
          <input
            id="order-quantity"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            type="number"
            min={1}
            max={config.max_quantity_per_order}
            step={1}
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700"
            disabled={Boolean(order)}
          />
        </label>
        <label className="text-sm font-semibold" htmlFor="order-mpesa-phone">
          M-PESA phone
          <input
            id="order-mpesa-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712345678"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700"
            disabled={paymentRequested}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">How do you want to receive your order?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-xl border p-3 ${deliveryOption === 'pickup' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'}`}>
            <input className="sr-only" type="radio" name="fulfillment" value="pickup" checked={deliveryOption === 'pickup'} onChange={() => setDeliveryOption('pickup')} disabled={Boolean(order)} />
            <span className="block text-sm font-semibold">Pick up myself</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">Free</span>
          </label>
          <label className={`rounded-xl border p-3 ${deliveryOption === 'd_delivery' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'} ${canDeliver ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
            <input className="sr-only" type="radio" name="fulfillment" value="d_delivery" checked={deliveryOption === 'd_delivery'} onChange={() => setDeliveryOption('d_delivery')} disabled={!canDeliver || Boolean(order)} />
            <span className="block text-sm font-semibold">D-Delivery</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">{canDeliver ? 'Have the item brought to you' : 'Unavailable until pilot zones are configured'}</span>
          </label>
        </div>
        {!canDeliver ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-zinc-500">Delivery destinations and fees are loaded from backend configuration. No zones are enabled yet.</p> : null}
      </fieldset>

      {deliveryOption === 'd_delivery' ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-zinc-950">
          <label className="block text-sm font-semibold" htmlFor="delivery-zone">
            Destination zone
            <select id="delivery-zone" value={zoneCode} onChange={(event) => setZoneCode(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)}>
              <option value="">Choose a configured destination</option>
              {config.delivery_zones.map((zone) => <option key={zone.zone_code} value={zone.zone_code}>{zone.display_name} — {formatKes(Number(zone.delivery_fee))}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold" htmlFor="delivery-receiver-name">
            Receiver name
            <input id="delivery-receiver-name" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} />
          </label>
          <label className="block text-sm font-semibold" htmlFor="delivery-receiver-phone">
            Receiver phone
            <input id="delivery-receiver-phone" value={receiverPhone} onChange={(event) => setReceiverPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="0712345678" className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} />
          </label>
          <label className="block text-sm font-semibold" htmlFor="delivery-location">
            Specific location / landmark
            <input id="delivery-location" value={dropoff} onChange={(event) => setDropoff(event.target.value)} placeholder="Hostel, apartment or landmark" className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} />
          </label>
          <label className="block text-sm font-semibold" htmlFor="delivery-instructions">
            Delivery instructions <span className="font-normal text-slate-500 dark:text-zinc-500">(optional)</span>
            <textarea id="delivery-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={2} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-zinc-700" disabled={Boolean(order)} />
          </label>
        </div>
      ) : null}

      <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-zinc-950">
        <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-zinc-500">Estimated breakdown. The backend recalculates the authoritative total from the current listing, fee configuration, inventory, and delivery zone.</p>
        <div className="flex justify-between gap-4"><span>Product ({quantity} × {formatKes(listingPrice)})</span><span>{formatKes(subtotal)}</span></div>
        <div className="mt-2 flex justify-between gap-4"><span>CampusTrader protection fee ({config.platform_fee_percent}%)</span><span>{formatKes(platformFee)}</span></div>
        <div className="mt-2 flex justify-between gap-4"><span>D-Delivery</span><span>{formatKes(deliveryFee)}</span></div>
        <div className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3 font-bold dark:border-zinc-800"><span>Total estimate</span><span>{formatKes(estimatedTotal)}</span></div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
        Payment is not marked secured when an STK request is accepted. Only a verified M-PESA callback can confirm payment. Seller settlement is not automatic.
      </div>

      {!config.payment_initiation_available ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          M-PESA setup is not configured. No order or payment request can be submitted yet.
        </p>
      ) : null}
      {errorMessage ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">{errorMessage}</p> : null}
      {status ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">{status}</p> : null}

      <button type="submit" disabled={busy || paymentRequested || !config.payment_initiation_available} className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? 'Preparing secure payment…' : paymentRequested ? 'Payment request sent' : order ? 'Retry payment request' : config.payment_initiation_available ? 'Pay & secure order' : 'M-PESA setup pending'}
      </button>
      {order ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
          <p className="font-semibold">Order {order.orderNumber} created</p>
          {order.totalAmount !== null ? <p className="mt-1">Backend-confirmed total: {formatKes(order.totalAmount)}</p> : <p className="mt-1 text-xs">The backend total is available in your order record.</p>}
        </div>
      ) : null}
      {order ? <Link href="/orders" className="block text-center text-sm font-semibold text-blue-600 underline-offset-4 hover:underline dark:text-blue-300">Track order {order.orderNumber}</Link> : null}
    </form>
  );
}
