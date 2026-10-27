import type { Metadata } from 'next';
import Link from 'next/link';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import HelpContactAction from '../../components/HelpContactAction';

export const metadata: Metadata = {
  title: 'Getting Started & Help | CampusTrader',
  description: 'Simple steps to browse, message sellers, post listings, verify your account and request support on CampusTrader.',
};

const steps = [
  { title: 'Create your account', text: 'Sign up with your name, email and institution. You can browse listings without signing in.', href: '/signin', action: 'Sign up' },
  { title: 'Find something you like', text: 'Open Home, browse listings and tap any photo or the blue View listing button to see full details.', href: '/', action: 'Explore listings' },
  { title: 'Talk to the seller', text: 'Open a listing and choose Message seller or Continue on WhatsApp. Agree on the item, price and collection before paying.', href: '/', action: 'Browse sellers' },
  { title: 'Set up your seller profile', text: 'Go to Profile → Edit profile. Add your WhatsApp number so buyers can contact you. You can also request a trusted badge using your student or national ID.', href: '/profile', action: 'Open profile' },
  { title: 'Post your first listing', text: 'Open Sell, add clear photos, a price and a description, then tap Post listing. If you sell as a business, create a business profile in Profile first.', href: '/sell', action: 'Post a listing' },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">CampusTrader guide</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">How to get started</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Browse, connect and trade in a few simple steps.</p>
        <div className="mt-6 space-y-3">
          {steps.map((step, index) => <section key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{index + 1}</span>
            <div className="min-w-0 flex-1"><h2 className="font-semibold">{step.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.text}</p><Link href={step.href} className="mt-2 inline-flex text-sm font-semibold text-blue-700 underline dark:text-blue-300">{step.action}</Link></div>
          </section>)}
        </div>
        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
          <h2 className="font-bold">Need help with an item or delivery?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Buyers and sellers can contact CampusTrader management for assistance checking an item, arranging collection or finding a delivery rider. Delivery is arranged individually and is not an automatic checkout.</p>
          <HelpContactAction />
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">For your safety, check an item's condition and confirm the seller before paying. Never share account passwords or PINs.</p>
      </main>
      <BottomNav />
    </div>
  );
}
