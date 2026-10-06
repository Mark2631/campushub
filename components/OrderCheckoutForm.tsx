'use client';

import { useEffect, useState } from 'react';
import { createMarketplaceOrder, getCheckoutConfig, requestOrderPayment } from '../lib/orders';

export default function OrderCheckoutForm({ listingId, listingPrice }: { listingId: string; listingPrice: number }) {
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState('');
  const [campus, setCampus] = useState('');
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'd_delivery'>('pickup');
  const [zoneCode, setZoneCode] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [config, setConfig] = useState<Awaited<ReturnType<typeof getCheckoutConfig>>['data']>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCheckoutConfig().then(({ data }) => setConfig(data)); }, []);

  const selectedZone = config?.delivery_zones.find((zone) => zone.zone_code === zoneCode);
  const subtotal = listingPrice * quantity;
  const platformFee = subtotal * ((config?.platform_fee_percent ?? 1) / 100);
  const deliveryFee = deliveryOption === 'd_delivery' ? Number(selectedZone?.delivery_fee ?? 0) : 0;
  const total = subtotal + platformFee + deliveryFee;
  const canDeliver = Boolean(config?.delivery_enabled && config.delivery_zones.length);

  async function submit() {
    setBusy(true); setStatus(null);
    if (!config) { setStatus('Checkout configuration is unavailable.'); setBusy(false); return; }
    if (quantity < 1 || quantity > config.max_quantity_per_order) { setStatus(`Quantity must be between 1 and ${config.max_quantity_per_order}.`); setBusy(false); return; }
    if (!phone.trim() || !campus.trim()) { setStatus('Add your M-Pesa phone number and campus.'); setBusy(false); return; }
    if (deliveryOption === 'd_delivery' && (!selectedZone || !dropoff.trim() || !receiverName.trim() || !receiverPhone.trim())) { setStatus('Choose a destination and add receiver name, phone, and specific location.'); setBusy(false); return; }
    const result = await createMarketplaceOrder({ listingId, quantity, deliveryOption, campus, dropoffLocation: [receiverName, receiverPhone, dropoff, instructions].filter(Boolean).join(' · '), deliveryZoneCode: deliveryOption === 'd_delivery' ? zoneCode : '', buyerPhone: phone, idempotencyKey: crypto.randomUUID() });
    if (result.error) { setStatus(result.error.message); setBusy(false); return; }
    const order = result.data as { order_number?: string; id?: string };
    const payment = order.id ? await requestOrderPayment(order.id, phone, crypto.randomUUID()) : null;
    setStatus(payment?.data?.error_code === 'PAYMENTS_NOT_CONFIGURED' ? `Order ${order.order_number || ''} created. Payment is not configured yet; no money was requested.` : `Order ${order.order_number || ''} created. Waiting for verified payment confirmation.`);
    setBusy(false);
  }

  return <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Quantity<input value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" min={1} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label><label className="text-sm font-semibold">M-Pesa phone<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="07…" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label></div>
    <label className="block text-sm font-semibold">Campus<input value={campus} onChange={(event) => setCampus(event.target.value)} placeholder="Your campus" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label>
    <fieldset><legend className="text-sm font-semibold">How do you want to receive your order?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setDeliveryOption('pickup')} className={`rounded-xl border p-3 text-left ${deliveryOption === 'pickup' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'}`}><span className="block text-sm font-semibold">Pick up myself</span><span className="text-xs text-slate-500">Free</span></button><button type="button" disabled={!canDeliver} onClick={() => setDeliveryOption('d_delivery')} className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${deliveryOption === 'd_delivery' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-zinc-800'}`}><span className="block text-sm font-semibold">D-Delivery</span><span className="text-xs text-slate-500">{canDeliver ? 'Manual campus delivery' : 'Unavailable until configured'}</span></button></div></fieldset>
    {deliveryOption === 'd_delivery' && <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-zinc-950"><label className="block text-sm font-semibold">Destination<select value={zoneCode} onChange={(event) => setZoneCode(event.target.value)} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3"><option value="">Choose a destination</option>{config?.delivery_zones.map((zone) => <option key={zone.zone_code} value={zone.zone_code}>{zone.display_name} — KSh {Number(zone.delivery_fee).toLocaleString()}</option>)}</select></label><label className="block text-sm font-semibold">Receiver name<input value={receiverName} onChange={(event) => setReceiverName(event.target.value)} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label><label className="block text-sm font-semibold">Receiver phone<input value={receiverPhone} onChange={(event) => setReceiverPhone(event.target.value)} inputMode="tel" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label><label className="block text-sm font-semibold">Specific location / landmark<input value={dropoff} onChange={(event) => setDropoff(event.target.value)} placeholder="Hostel, apartment or landmark" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label><label className="block text-sm font-semibold">Delivery instructions <span className="font-normal text-slate-500">(optional)</span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" /></label></div>}
    <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-zinc-950"><p className="mb-3 text-xs text-slate-500 dark:text-zinc-500">Estimated breakdown. The backend recalculates and confirms the authoritative total when you submit.</p><div className="flex justify-between"><span>Product</span><span>KSh {subtotal.toLocaleString()}</span></div><div className="mt-2 flex justify-between"><span>CampusTrader protection fee ({config?.platform_fee_percent ?? 1}%)</span><span>KSh {platformFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div><div className="mt-2 flex justify-between"><span>D-Delivery</span><span>KSh {deliveryFee.toLocaleString()}</span></div><div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-bold dark:border-zinc-800"><span>Total</span><span>KSh {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div></div>
    <button type="button" onClick={submit} disabled={busy || !config} className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Preparing protected order…' : 'Pay & secure order'}</button>{status && <p role="status" className="text-sm leading-6 text-slate-600 dark:text-zinc-300">{status}</p>}
  </div>;
}
