'use client';

import { useState } from 'react';
import { createMarketplaceOrder, getCheckoutConfig, requestOrderPayment } from '../lib/orders';

export default function OrderCheckoutForm({ listingId, listingPrice }: { listingId: string; listingPrice: number }) {
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState('');
  const [campus, setCampus] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus(null);
    const config = await getCheckoutConfig();
    if (config.error || !config.data) {
      setStatus('Checkout configuration is unavailable. Please try again later.');
      setBusy(false);
      return;
    }
    if (quantity < 1 || quantity > config.data.max_quantity_per_order) {
      setStatus(`Quantity must be between 1 and ${config.data.max_quantity_per_order}.`);
      setBusy(false);
      return;
    }
    const idempotencyKey = crypto.randomUUID();
    const result = await createMarketplaceOrder({ listingId, quantity, deliveryOption: 'pickup', campus, dropoffLocation: '', deliveryZoneCode: '', buyerPhone: phone, idempotencyKey });
    if (result.error) {
      setStatus(result.error.message);
      setBusy(false);
      return;
    }
    const order = result.data as { order_number?: string; total_amount?: number; id?: string };
    const payment = order.id ? await requestOrderPayment(order.id, phone, crypto.randomUUID()) : null;
    setStatus(payment?.data?.error_code === 'PAYMENTS_NOT_CONFIGURED' ? `Order ${order.order_number || ''} created. Payment is not configured yet; no money was requested.` : `Order ${order.order_number || ''} created. Payment remains pending verification.`);
    setBusy(false);
  }

  return <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Quantity<input value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" min={1} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label><label className="text-sm font-semibold">M-Pesa phone<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="07…" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label></div><label className="mt-3 block text-sm font-semibold">Campus<input value={campus} onChange={(event) => setCampus(event.target.value)} placeholder="Your campus" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label><button type="button" onClick={submit} disabled={busy} className="mt-4 w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Preparing protected order…' : `Create order · KSh ${(listingPrice * quantity).toLocaleString()}`}</button>{status && <p role="status" className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-300">{status}</p>}</div>;
}
