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
    setChecked(false);
    if (!user) return;
    const key = `campustrader-setup-dismissed:${user.id}`;
    try { setDismissed(window.localStorage.getItem(key) === '1'); } catch { setDismissed(false); }
    void getProfileById(user.id).then(({ profile }) => {
      if (!active) return;
      setPhoneReady(Boolean(profile?.phone_number?.trim()));
      setVerificationStarted(Boolean(profile?.verification_status && !['unverified', 'none', 'rejected'].includes(profile.verification_status)));
      setChecked(true);
    }).catch(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, [user]);

  if (loading || !user || !checked || dismissed || (phoneReady && verificationStarted)) return null;
  const steps = [
    { title: 'Account created', done: true, href: '/profile', detail: 'You are signed in.' },
    { title: 'Add your WhatsApp number', done: phoneReady, href: '/profile?setup=phone', detail: 'Let buyers contact you directly.' },
    { title: 'Verify your profile', done: verificationStarted, href: '/profile?setup=verification', detail: 'Upload a student ID or national ID.' },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem(`campustrader-setup-dismissed:${user.id}`, '1'); } catch { /* Storage may be unavailable. */ }
  };
  return (
    <aside aria-label="Your CampusTrader setup" className="fixed bottom-20 right-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl dark:border-blue-900 dark:bg-slate-900 sm:bottom-6 sm:right-6">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Your CampusTrader setup</p><h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">Get ready to trade</h2></div>
        <button type="button" onClick={dismiss} aria-label="Dismiss setup checklist" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.round(doneCount / steps.length * 100)}%` }} /></div><span className="text-xs font-bold text-blue-700 dark:text-blue-300">{Math.round(doneCount / steps.length * 100)}%</span></div>
      <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {steps.map((step) => <Link key={step.title} href={step.href} className="flex items-center gap-3 py-2.5">
          {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-slate-400" />}
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900 dark:text-white">{step.title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{step.detail}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>)}
      </div>
    </aside>
  );
}
