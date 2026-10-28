'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight, X } from 'lucide-react';
import useUser from '../hooks/useUser';
import { getProfileById } from '../lib/profiles';

export default function GettingStartedChecklist() {
  const { user, loading } = useUser();
  const [phoneReady, setPhoneReady] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) return () => { active = false; };
    void getProfileById(user.id).then(({ profile }) => {
      if (!active) return;
      setPhoneReady(Boolean(profile?.phone_number));
      setVerificationStarted(Boolean(profile?.verification_status && profile.verification_status !== 'unverified' && profile.verification_status !== 'none'));
      setChecked(true);
    });
    return () => { active = false; };
  }, [user]);

  if (loading || !user || dismissed) return null;
  const steps = [
    { title: 'Create your account', done: true, href: '/profile', detail: 'You are signed in.' },
    { title: 'Add your WhatsApp number', done: phoneReady, href: '/profile?setup=contact', detail: 'Buyers can contact you directly.' },
    { title: 'Verify your profile', done: verificationStarted, href: '/profile?setup=verification', detail: 'Open Edit profile to submit your student or national ID.' },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  return (
    <aside aria-label="Your CampusTrader setup" className="fixed bottom-20 right-3 z-40 w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border border-blue-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:border-blue-900 dark:bg-slate-900/95 sm:bottom-5 sm:right-5 sm:p-4">
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss setup checklist" title="Dismiss" className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
      <div className="flex items-start justify-between gap-8 pr-6">
        <div><p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Your CampusTrader setup</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Get ready to trade</h2></div>
        <span className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300">{checked ? Math.round(doneCount / steps.length * 100) : '…'}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: checked ? `${doneCount / steps.length * 100}%` : '0%' }} /></div>
      <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        {steps.map((step) => <Link key={step.title} href={step.href} className="flex items-center gap-2.5 py-2">
          {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-slate-400" />}
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-900 dark:text-white">{step.title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{step.detail}</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>)}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3"><Link href="/sell" className="text-xs font-semibold text-blue-700 underline dark:text-blue-300">Post a listing</Link><button type="button" onClick={() => setDismissed(true)} className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Got it · Dismiss</button></div>
    </aside>
  );
}
