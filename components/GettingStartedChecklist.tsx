'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import useUser from '../hooks/useUser';
import { getProfileById } from '../lib/profiles';
import { getListingsByUser } from '../lib/listings';

export default function GettingStartedChecklist() {
  const { user, loading } = useUser();
  const [phoneReady, setPhoneReady] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [listingReady, setListingReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) return;
    void Promise.all([getProfileById(user.id), getListingsByUser(user.id)]).then(([{ profile }, { listings }]) => {
      if (!active) return;
      setPhoneReady(Boolean(profile?.phone_number));
      setListingReady(listings.length > 0);
      setVerificationStarted(Boolean(profile?.verification_status && profile.verification_status !== 'unverified' && profile.verification_status !== 'none'));
      setChecked(true);
    });
    return () => { active = false; };
  }, [user]);

  if (loading || !user) return null;
  const steps = [
    { title: 'Create your account', done: true, href: '/profile', detail: 'You are signed in.' },
    { title: 'Add your WhatsApp number', done: phoneReady, href: '/profile', detail: 'Let interested buyers reach you.' },
    { title: 'Post your first listing', done: listingReady, href: '/sell', detail: 'Show buyers what you are selling.' },
    { title: 'Start profile verification', done: verificationStarted, href: '/profile', detail: 'Optional: apply for a trusted badge.' },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  return (
    <section aria-label="Getting started" className="mb-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Your CampusTrader setup</p><h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Get ready to trade</h2></div>
        <span className="shrink-0 text-sm font-bold text-blue-700 dark:text-blue-300">{checked ? Math.round(doneCount / steps.length * 100) : '…'}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: checked ? `${doneCount / steps.length * 100}%` : '0%' }} /></div>
      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {steps.map((step) => <Link key={step.title} href={step.href} className="flex items-center gap-3 py-3">
          {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-slate-400" />}
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900 dark:text-white">{step.title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{step.detail}</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>)}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">You can browse and message sellers before verification is complete. Selling as a business? Create a business profile in Profile.</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold"><Link href="/sell" className="rounded-xl bg-blue-600 px-4 py-2.5 text-white">Post a listing</Link><Link href="/help" className="rounded-xl border border-slate-200 px-4 py-2.5 text-blue-700 dark:border-slate-700 dark:text-blue-300">How it works</Link></div>
    </section>
  );
}
