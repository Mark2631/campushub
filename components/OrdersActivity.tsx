'use client';

import { useEffect, useState } from 'react';
import { confirmOrderReceipt, getMyOrders, openOrderDispute } from '../lib/orders';

type Order = { id: string; order_number: string; listing_title_snapshot: string; quantity: number; total_amount: number; order_state: string; payment_state: string; delivery_option: string; created_at: string };
const label = (value: string) => value.replaceAll('_', ' ');

export default function OrdersActivity() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('Loading protected activity…');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() { const { data, error } = await getMyOrders(); if (error) setMessage('Order activity is unavailable for this session.'); else { setOrders((data || []) as Order[]); setMessage(data?.length ? '' : 'No protected orders yet.'); } }
  // Load the server-authoritative order list when the activity surface mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function receipt(orderId: string) { if (!window.confirm('Only confirm after you have received and checked your order. Continue?')) return; setBusy(orderId); const { error } = await confirmOrderReceipt(orderId); setFeedback(error ? error.message : 'Receipt confirmed. The transaction is now eligible for operator review.'); await load(); setBusy(null); }
  async function dispute(orderId: string) { const reason = window.prompt('Why are you disputing this transaction?'); if (!reason) return; setBusy(orderId); const { error } = await openOrderDispute(orderId, 'Other', reason); setFeedback(error ? error.message : 'Dispute opened. Transaction under review.'); await load(); setBusy(null); }

  if (message) return <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900"><p className="text-sm text-slate-500 dark:text-zinc-400">{message}</p></section>;
  return <section className="mt-5 space-y-3">{feedback && <p role="status" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">{feedback}</p>}{orders.map((order) => { const canConfirm = ['awaiting_receipt', 'delivered'].includes(order.order_state); return <article key={order.id} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">{order.order_number}</p><h2 className="mt-2 font-bold">{order.listing_title_snapshot}</h2><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p></div><p className="font-bold">KSh {Number(order.total_amount).toLocaleString()}</p></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-zinc-800">{label(order.order_state)}</span><span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">Payment: {label(order.payment_state)}</span><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-zinc-800">{label(order.delivery_option)}</span></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => receipt(order.id)} disabled={!canConfirm || busy === order.id} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Confirm receipt</button><button type="button" onClick={() => dispute(order.id)} disabled={busy === order.id || ['completed', 'cancelled'].includes(order.order_state)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-zinc-700">Report a problem</button></div></article>; })}</section>;
}
