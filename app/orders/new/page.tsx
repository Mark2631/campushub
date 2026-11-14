import Link from 'next/link';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import WhatsAppButton from '../../../components/WhatsAppButton';

export default function NewOrderPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-950">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-bold">Orders are being prepared</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Online checkout is not available yet. Contact CampusTrader about the item, confirm the details and agree on collection or delivery before making payment.
          </p>
          <div className="mt-5">
            <WhatsAppButton label="Ask CampusTrader on WhatsApp" />
          </div>
          <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-blue-700 underline dark:text-blue-300">Continue browsing</Link>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
