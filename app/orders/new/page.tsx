import Link from 'next/link';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';

export default function NewOrderPage() {
  return <div className="min-h-screen bg-[var(--background)] pb-24 dark:bg-[var(--background)]"><Header /><main className="mx-auto max-w-xl px-4 py-12"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center dark:border-[var(--border)] dark:bg-[var(--surface)]"><h1 className="text-2xl font-bold">Orders coming soon</h1><p className="mt-3 text-sm text-[var(--muted)] dark:text-[var(--muted)]">For now, open a listing and message the seller or contact them on WhatsApp. For help with delivery or checking an item, contact CampusTrader support.</p><Link href="/" className="mt-5 inline-flex rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white">Explore listings</Link></section></main><BottomNav /></div>;
}
