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
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] dark:bg-[var(--background)] dark:text-[var(--foreground)]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand)] dark:text-[var(--brand)]">CampusTrader guide</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">How to get started</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)] dark:text-[var(--muted)]">Browse, connect and trade in a few simple steps.</p>
        <div className="mt-6 space-y-3">
          {steps.map((step, index) => <section key={step.title} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 dark:border-[var(--border)] dark:bg-[var(--surface)]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">{index + 1}</span>
            <div className="min-w-0 flex-1"><h2 className="font-semibold">{step.title}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)] dark:text-[var(--muted)]">{step.text}</p><Link href={step.href} className="mt-2 inline-flex text-sm font-semibold text-[var(--brand)] underline dark:text-[var(--brand)]">{step.action}</Link></div>
          </section>)}
        </div>
        <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-5 dark:border-[var(--border)] dark:bg-[var(--brand-soft)]">
          <h2 className="font-bold">Need help with an item or delivery?</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)] dark:text-[var(--muted)]">Buyers and sellers can contact CampusTrader management for assistance checking an item, arranging collection or finding a delivery rider. Delivery is arranged individually and is not an automatic checkout.</p>
          <HelpContactAction />
        </section>
        <p className="mt-5 text-xs leading-5 text-[var(--muted)] dark:text-[var(--muted)]">For your safety, check an item&apos;s condition and confirm the seller before paying. Never share account passwords or PINs.</p>
      </main>
      <BottomNav />
    </div>
  );
}
