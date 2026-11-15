import Link from 'next/link';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';

export default function NewOrderPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-950">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-bold">Orders coming soon</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Online checkout is not available yet. Open a product and use its WhatsApp enquiry to contact CampusTrader management with the item details. You can also use in-app messages to speak directly with the seller.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Confirm availability, price and collection arrangements before making a payment.
          </p>
          <Link href="/" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
            Explore products
          </Link>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
