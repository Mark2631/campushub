import type { Metadata } from 'next';
import BottomNav from '../../components/BottomNav';
import Header from '../../components/Header';
import HelpContactAction from '../../components/HelpContactAction';
import { transactionHelpTopics } from '../../lib/transactionHelp';

export const metadata: Metadata = {
  title: 'Help & Support | CampusTrader',
  description: 'Learn how CampusTrader orders, M-PESA payment confirmation, pickup, D-Delivery, receipt confirmation, disputes, and support work.',
};

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:py-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">Manage · Help &amp; support</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Help &amp; support</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Guidance for buying, payments, delivery, and order follow-up on CampusTrader.
          </p>
        </header>

        <section aria-labelledby="contact-support-heading" className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
          <h2 id="contact-support-heading" className="font-semibold">Still need help?</h2>
          <HelpContactAction />
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Use CampusTrader&apos;s existing report issue form. Include the order number when you have one, and never include a PIN or password.
          </p>
        </section>

        <section aria-label="Transaction help" className="mt-6 grid gap-3 sm:grid-cols-2">
          {transactionHelpTopics.map((topic) => (
            <article key={topic.title} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold">{topic.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{topic.content}</p>
            </article>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
