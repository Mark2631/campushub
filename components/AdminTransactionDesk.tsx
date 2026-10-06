'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const pretty = (value: string) => value.replaceAll('_', ' ');
type TransactionRow = { id: string; order_number?: string; listing_title_snapshot?: string; total_amount?: number; platform_fee_amount?: number; delivery_fee_snapshot?: number; payment_state?: string; seller_release_state?: string; buyer_receipt_state?: string; order_id?: string; delivery_state?: string; assigned_rider_id?: string | null };

export default function AdminTransactionDesk({ mode }: { mode: 'escrow' | 'delivery' }) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const query = mode === 'escrow'
      ? supabase.from('orders').select('id, order_number, listing_title_snapshot, buyer_id, seller_id, total_amount, platform_fee_amount, delivery_fee_snapshot, order_state, payment_state, seller_acceptance_state, seller_release_state, buyer_receipt_state, payout_state, created_at').order('created_at', { ascending: false }).limit(100)
      : supabase.from('deliveries').select('id, order_id, buyer_id, seller_id, delivery_fee_snapshot, assigned_rider_id, delivery_state, requested_at, updated_at').order('requested_at', { ascending: false }).limit(100);
    const { data, error: queryError } = await query;
    setRows(data || []); setError(queryError?.message || null);
  }
  // The transaction desk must re-query when the admin switches between escrow and delivery.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [mode]);

  async function act(row: TransactionRow, action: string) {
    setWorking(row.id); setNotice(null);
    let result;
    if (action === 'release') { const reference = window.prompt('Enter the external settlement reference.'); if (!reference) { setWorking(null); return; } result = await supabase.rpc('admin_record_manual_payout', { p_order_id: row.id, p_external_reference: reference, p_admin_note: 'Manual release from admin escrow desk' }); }
    if (action === 'dispatch') result = await supabase.rpc('rider_advance_delivery', { p_delivery_id: row.id, p_next_state: 'in_transit' });
    if (action === 'delivered') result = await supabase.rpc('rider_advance_delivery', { p_delivery_id: row.id, p_next_state: 'delivered' });
    if (action === 'failed') result = await supabase.rpc('rider_report_delivery_problem', { p_delivery_id: row.id, p_description: 'Operator marked delivery as failed.' });
    setNotice(result?.error ? result.error.message : 'Action recorded by the backend.'); await load(); setWorking(null);
  }

  return <section className="space-y-4"><div><h2 className="text-xl font-bold">{mode === 'escrow' ? 'Escrow' : 'D-Delivery'}</h2><p className="mt-1 text-sm text-zinc-400">Backend-authoritative records only. No client-side payment or release state is simulated.</p></div>{notice && <p role="status" className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">{notice}</p>}{error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(mode === 'escrow' ? ['payment_pending', 'payment_secured', 'seller_accepted', 'disputed'] : ['requested', 'searching_rider', 'in_transit', 'delivered']).map((state) => <div key={state} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-2xl font-bold">{rows.filter((row) => (mode === 'escrow' ? row.payment_state : row.delivery_state) === state).length}</p><p className="mt-1 text-xs capitalize text-zinc-500">{pretty(state)}</p></div>)}</div>{rows.length === 0 ? <EmptyState text={error ? 'The admin transaction contract is unavailable for this account.' : 'No transaction records yet.'} /> : <div className="space-y-3">{rows.map((row) => <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-300">{mode === 'escrow' ? row.order_number : row.order_id}</p><h3 className="mt-2 font-semibold">{mode === 'escrow' ? row.listing_title_snapshot : `Delivery · ${pretty(String(row.delivery_state || 'unknown'))}`}</h3></div><p className="font-bold">{mode === 'escrow' ? `KSh ${Number(row.total_amount).toLocaleString()}` : `KSh ${Number(row.delivery_fee_snapshot || 0).toLocaleString()}`}</p></div><div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400"><span className="rounded-full bg-zinc-900 px-3 py-2">{pretty(String(mode === 'escrow' ? row.payment_state || 'unknown' : row.delivery_state || 'unknown'))}</span>{mode === 'escrow' && <><span className="rounded-full bg-zinc-900 px-3 py-2">Release: {pretty(String(row.seller_release_state || 'unknown'))}</span><span className="rounded-full bg-zinc-900 px-3 py-2">Receipt: {pretty(String(row.buyer_receipt_state || 'unknown'))}</span></>}</div><div className="mt-4 flex flex-wrap gap-2">{mode === 'escrow' && row.seller_release_state === 'eligible_for_settlement' && <button type="button" disabled={working === row.id} onClick={() => act(row, 'release')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Release transaction</button>}{mode === 'delivery' && <><button type="button" onClick={() => act(row, 'dispatch')} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold">Mark in transit</button><button type="button" onClick={() => act(row, 'delivered')} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Mark delivered</button><button type="button" onClick={() => act(row, 'failed')} className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300">Mark failed</button></>}</div></article>)}</div>}</section>;
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">{text}</div>; }
