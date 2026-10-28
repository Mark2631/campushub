'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, ListChecks, X } from 'lucide-react';
import useUser from '../hooks/useUser';
import { getProfileById } from '../lib/profiles';

export default function GettingStartedChecklist() {
  const { user, loading } = useUser();
  const [phoneReady, setPhoneReady] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `campustrader-setup-dismissed-${user.id}`;
    setDismissed(window.localStorage.getItem(key) === 'yes');
    let active = true;
    void getProfileById(user.id).then(({ profile }) => {
      if (!active) return;
      setPhoneReady(Boolean(profile?.phone_number));
      setVerificationStarted(Boolean(profile?.verification_status && !['unverified', 'none'].includes(profile.verification_status)));
      setChecked(true);
    });
    return () => { active = false; };
  }, [user]);

  if (loading || !user || dismissed) return null;
  const steps = [
    { title: 'Account created', done: true, href: '/profile', detail: 'Ready' },
    { title: 'Add WhatsApp number', done: phoneReady, href: '/profile?setup=phone', detail: 'Opens Edit profile' },
    { title: 'Verify your profile', done: verificationStarted, href: '/profile?setup=verification', detail: 'Opens the ID upload form' },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const dismiss = () => {
    window.localStorage.setItem(`campustrader-setup-dismissed-${user.id}`, 'yes');
    setDismissed(true);
  };
  return (
    <aside aria-label="CampusTrader setup assistant" className="fixed bottom-24 right-3 z-40 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-blue-200 bg-white p-3 shadow-xl dark:border-blue-900 dark:bg-slate-900 sm:bottom-6 sm:right-6">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 shrink-0 text-blue-600" />
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
          <span className="truncate text-sm font-bold text-slate-900 dark:text-white">Your CampusTrader setup</span>
          <span className="shrink-0 text-xs font-bold text-blue-600">{checked ? Math.round(doneCount / steps.length * 100) : '…'}%</span>
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss setup assistant" title="Dismiss" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600" style={{ width: checked ? `${doneCount / steps.length * 100}%` : '0%' }} /></div>
      {expanded ? <div className="mt-2 space-y-1">{steps.map((step) => <Link key={step.title} href={step.href} className="flex items-center gap-2 rounded-lg px-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">{step.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-slate-400" />}<span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{step.title}</span><span className="block text-[11px] text-slate-500">{step.detail}</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></Link>)}<Link href="/help" className="block pt-2 text-xs font-semibold text-blue-600">See the full guide</Link></div> : <button type="button" onClick={() => setExpanded(true)} className="mt-2 w-full text-left text-xs font-semibold text-blue-600">Show next steps</button>}
    </aside>
  );
}
