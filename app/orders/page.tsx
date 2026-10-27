import Link from 'next/link';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
export default function OrdersPage() {
  return <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-950"><Header /><main className="mx-auto max-w-xl px-4 py-12"><section className="rounded-2xl border border-slate-200 bg-white p-7 text-center dark:border-slate-800 dark:bg-slate-900"><h1 className="text-2xl font-bold">Orders coming soon</h1><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">You can still trade by messaging a seller directly. Need an item checked or delivered? Contact CampusTrader support.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Browse listings</Link><Link href="/help" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold dark:border-slate-700">Get help</Link></div></section></main><BottomNav /></div>;
}
