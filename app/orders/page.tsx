'use client';

import Link from 'next/link';
import { ArrowLeft, Package, ShieldCheck } from 'lucide-react';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import useUser from '../../hooks/useUser';
import OrdersActivity from '../../components/OrdersActivity';

const tabs = ['Buying', 'Selling', 'Delivery'] as const;

export default function OrdersPage() {
  const { user, loading } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:from-black dark:to-zinc-950 dark:text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Profile</Link>
        <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Payments & orders</p><h1 className="mt-2 text-3xl font-bold">Orders</h1><p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Track protected purchases, sales, and D-Delivery from one place.</p></div>
        <div className="mt-6 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">{tabs.map((tab) => <button key={tab} type="button" className={`rounded-xl px-3 py-3 text-sm font-semibold ${tab === 'Buying' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-zinc-400'}`}>{tab}</button>)}</div>
        {user && <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">Funds activity</p><h2 className="mt-2 font-bold">Protected payment activity</h2></div><ShieldCheck className="h-5 w-5 text-blue-500" aria-hidden="true" /></div><div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-zinc-950"><div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-400">Payment merchant</span><span className="font-semibold">Till 6362615</span></div><div className="mt-2 flex justify-between"><span className="text-slate-500 dark:text-zinc-400">Platform fee</span><span>1% · backend configured</span></div><p className="mt-4 text-xs leading-5 text-slate-500 dark:text-zinc-500">Verified payment, held funds, seller release, refunds, and payouts will appear here from the transaction service. This screen never infers payment from an STK request or screenshot.</p></div></section>}
        {!user && !loading ? <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"><Package className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold">Sign in to view orders</h2><Link href="/signin?next=/orders" className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></section> : <OrdersActivity />}
      </main>
      <BottomNav />
    </div>
  );
}
