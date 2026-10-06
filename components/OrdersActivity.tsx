'use client';

import { useEffect, useState } from 'react';
import { getMyOrders } from '../lib/orders';

type Order = { id: string; order_number: string; listing_title_snapshot: string; quantity: number; total_amount: number; order_state: string; payment_state: string; delivery_option: string; created_at: string };

export default function OrdersActivity() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('Loading protected activity…');

  useEffect(() => {
    let active = true;
    getMyOrders().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage('Order activity is unavailable for this session.');
      else { setOrders((data || []) as Order[]); setMessage(data?.length ? '' : 'No protected orders yet.'); }
    });
    return () => { active = false; };
  }, []);

  if (message) return <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900"><p className="text-sm text-slate-500 dark:text-zinc-400">{message}</p></section>;
  return <section className="mt-5 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">{order.order_number}</p><h2 className="mt-2 font-bold">{order.listing_title_snapshot}</h2></div><p className="font-bold">KSh {Number(order.total_amount).toLocaleString()}</p></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-zinc-800">Order: {order.order_state.replaceAll('_', ' ')}</span><span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">Payment: {order.payment_state.replaceAll('_', ' ')}</span><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-zinc-800">{order.delivery_option}</span></div></article>)}</section>;
}
