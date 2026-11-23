'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import BottomNav from './BottomNav';
import Header from './Header';
import OrdersActivity from './OrdersActivity';
import useUser from '../hooks/useUser';

type Props = { initialView: 'buying' | 'selling' };

export default function OrdersPageContent({ initialView }: Props) {
  const { user, loading } = useUser();
  const [activeTab, setActiveTab] = useState(initialView);

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--brand)] dark:text-[var(--muted)] dark:hover:text-[var(--brand)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Profile
        </Link>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)] dark:text-[var(--brand)]">Manage · Payments & orders</p>
          <h1 className="mt-2 text-3xl font-bold">Orders</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)] dark:text-[var(--muted)]">Track purchases, sales, payment verification, fulfilment, and receipt confirmation.</p>
        </div>

        {user ? (
          <section aria-label="Request shortcuts" className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setActiveTab('buying')} className="rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-4 text-left transition hover:border-[var(--brand)] dark:border-[var(--border)] dark:bg-[var(--brand-soft)]">
              <span className="block text-sm font-bold text-[var(--brand)] dark:text-[var(--brand)]">My requests</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--brand)]/70 dark:text-[var(--brand)]/70">Orders you placed</span>
            </button>
            <button type="button" onClick={() => setActiveTab('selling')} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--brand)]">
              <span className="block text-sm font-bold text-[var(--brand)]">Incoming requests</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Requests for your listings</span>
            </button>
          </section>
        ) : null}

        <div role="tablist" aria-label="Orders" className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 dark:border-[var(--border)] dark:bg-[var(--surface)]">
          {(['buying', 'selling'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`orders-tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls="orders-panel"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-3 py-3 text-sm font-semibold capitalize ${activeTab === tab ? 'bg-[var(--brand)] text-white' : 'text-[var(--muted)] dark:text-[var(--muted)]'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div id="orders-panel" role="tabpanel" aria-labelledby={`orders-tab-${activeTab}`}>
          {loading ? (
            <section className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--muted)]">Checking your session…</section>
          ) : user ? (
            <OrdersActivity userId={user.id} activeTab={activeTab} />
          ) : (
            <section className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center dark:border-[var(--border)] dark:bg-[var(--surface)]">
              <Package className="mx-auto size-10 text-[var(--muted)]" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold">Sign in to view orders</h2>
              <Link href={`/signin?next=${encodeURIComponent('/orders')}`} className="mt-5 inline-flex rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white">Sign in</Link>
            </section>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
