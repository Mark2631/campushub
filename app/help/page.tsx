import type { Metadata } from 'next';
import Link from 'next/link';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import HelpContactAction from '../../components/HelpContactAction';

export const metadata: Metadata = {
  title: 'How CampusTrader Works | Help',
  description: 'Learn how to browse campus products, contact CampusTrader management, arrange collection and list items for sale.',
};

const steps = [
  {
    title: 'Find a product',
    text: 'Search by name or browse a category such as electronics, books, fashion or furniture. Open a product to see its photos, price, condition and description.',
    href: '/',
    action: 'Browse products',
  },
  {
    title: 'Ask CampusTrader',
    text: 'Choose Continue on WhatsApp on the product page. Your message goes to CampusTrader management with the product name and listing link already included.',
    href: '/',
    action: 'View products',
  },
  {
    title: 'Confirm the details',
    text: 'Ask about availability, agree on the price and confirm the collection or delivery arrangement before sending money.',
    href: '/',
    action: 'Explore the catalogue',
  },
  {
    title: 'Sell on CampusTrader',
    text: 'Sign in, add clear photos, write an honest description and set the price. Keep your listing details up to date so buyers know what is available.',
    href: '/sell',
    action: 'Post a listing',
  },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28 sm:py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">CampusTrader guide</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">A simpler way to trade around campus.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          CampusTrader brings student sellers and nearby businesses together so people can find everyday products without searching through endless group chats.
        </p>

        <div className="mt-6 space-y-3">
          {steps.map((step, index) => (
            <section key={step.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{step.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.text}</p>
                <Link href={step.href} className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300">{step.action}</Link>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold">Need help with an item or delivery?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Contact CampusTrader management for help confirming an item, arranging collection or finding a delivery option. Delivery is coordinated manually; it is not an automatic checkout.
          </p>
          <HelpContactAction />
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Inspect the item and confirm who you are dealing with before paying. Never share account passwords, M-PESA PINs or one-time verification codes.
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
