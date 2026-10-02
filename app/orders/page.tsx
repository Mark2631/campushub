'use client';

import Link from 'next/link';
import { ArrowLeft, Package, ShieldCheck, Truck } from 'lucide-react';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import useUser from '../../hooks/useUser';

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
        {!user && !loading ? <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"><Package className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold">Sign in to view orders</h2><Link href="/signin?next=/orders" className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></section> : <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900"><ShieldCheck className="mx-auto h-10 w-10 text-blue-500" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold">No protected orders yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-zinc-400">When the backend order service is connected, payment-pending and secured orders will appear here with their live status timeline.</p><div className="mt-6 flex flex-wrap justify-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-400"><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-zinc-800">Payment secured</span><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-zinc-800">Handover</span><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-zinc-800"><Truck className="mr-1 inline h-3 w-3" aria-hidden="true" />Delivery</span></div></section>}
      </main>
      <BottomNav />
    </div>
  );
}
