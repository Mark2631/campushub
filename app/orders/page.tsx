import Link from 'next/link';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
export default function OrdersPage() {
  return <div className="min-h-screen bg-[var(--background)] pb-24 dark:bg-[var(--background)]"><Header /><main className="mx-auto max-w-xl px-4 py-12"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center dark:border-[var(--border)] dark:bg-[var(--surface)]"><h1 className="text-2xl font-bold">Orders coming soon</h1><p className="mt-3 text-sm text-[var(--muted)] dark:text-[var(--foreground)]">You can still trade by messaging a seller directly. Need an item checked or delivered? Contact CampusTrader support.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/" className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white">Browse listings</Link><Link href="/help" className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold dark:border-slate-700">Get help</Link></div></section></main><BottomNav /></div>;
}
