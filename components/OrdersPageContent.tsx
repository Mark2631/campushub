'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Package, ShieldCheck } from 'lucide-react';
import BottomNav from './BottomNav';
import Header from './Header';
import OrdersActivity from './OrdersActivity';
import useUser from '../hooks/useUser';

type Props = { initialView: 'buying' | 'selling' };

export default function OrdersPageContent({ initialView }: Props) {
  const { user, loading } = useUser();
  const [activeTab, setActiveTab] = useState(initialView);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:from-black dark:to-zinc-950 dark:text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Profile
        </Link>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Manage · Payments & orders</p>
          <h1 className="mt-2 text-3xl font-bold">Orders</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">Track purchases, sales, payment verification, fulfilment, and receipt confirmation.</p>
        </div>

        {user ? (
          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-blue-500" aria-hidden="true" />
              <h2 className="font-bold">Protected payment status</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-400">An M-PESA request is not proof of payment. Orders show Payment secured only after backend verification. Seller settlement is manually handled and is never inferred from a receipt or screenshot.</p>
          </section>
        ) : null}

        <div role="tablist" aria-label="Orders" className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {(['buying', 'selling'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`orders-tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls="orders-panel"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-3 py-3 text-sm font-semibold capitalize ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-zinc-400'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div id="orders-panel" role="tabpanel" aria-labelledby={`orders-tab-${activeTab}`}>
          {loading ? (
            <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">Checking your session…</section>
          ) : user ? (
            <OrdersActivity userId={user.id} activeTab={activeTab} />
          ) : (
            <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <Package className="mx-auto size-10 text-slate-400" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold">Sign in to view orders</h2>
              <Link href={`/signin?next=${encodeURIComponent('/orders')}`} className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Sign in</Link>
            </section>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
