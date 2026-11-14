import type { Metadata } from 'next';
import Link from 'next/link';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import HelpContactAction from '../../components/HelpContactAction';

export const metadata: Metadata = {
  title: 'Getting Started & Help | CampusTrader',
  description: 'Browse campus products, contact CampusTrader for help, and learn how to list items on the marketplace.',
};

const steps = [
  { title: 'Browse the catalogue', text: 'Search by product name or choose a category. You can explore public listings without creating an account.', href: '/', action: 'Browse products' },
  { title: 'Check the product details', text: 'Open a listing to review its photos, description, condition, price and location before making a decision.', href: '/', action: 'Explore listings' },
  { title: 'Contact CampusTrader', text: 'Use the WhatsApp button on a product page. It opens the official CampusTrader contact, with the product details included so the team can help confirm availability and connect you with the seller.', href: '/', action: 'Find an item' },
  { title: 'Agree on the handoff', text: 'Confirm the final price, item condition and collection or delivery arrangement before paying. Do not send advance payments to an unconfirmed contact.', href: '/', action: 'View products' },
  { title: 'List an item or service', text: 'Create an account, complete your profile, then add clear photos, an honest description, price and location. Students and eligible businesses can list on CampusTrader.', href: '/sell', action: 'Post a listing' },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">CampusTrader guide</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">How CampusTrader works</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Find an item, contact the team, then agree on a safe handoff.</p>
        <div className="mt-6 space-y-3">
          {steps.map((step, index) => <section key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{index + 1}</span>
            <div className="min-w-0 flex-1"><h2 className="font-semibold">{step.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.text}</p><Link href={step.href} className="mt-2 inline-flex text-sm font-semibold text-blue-700 underline dark:text-blue-300">{step.action}</Link></div>
          </section>)}
        </div>
        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
          <h2 className="font-bold">Need help with an item or delivery?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">CampusTrader management can help confirm availability, connect you with a seller and coordinate the next step. Delivery is arranged individually; checkout is not automatic.</p>
          <HelpContactAction />
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">Inspect the item and confirm the seller, price and collection plan before paying. Never share account passwords or PINs.</p>
      </main>
      <BottomNav />
    </div>
  );
}
