'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, X } from 'lucide-react';
import useUser from '../hooks/useUser';
import { getProfileById } from '../lib/profiles';

export default function GettingStartedChecklist() {
  const { user, loading } = useUser();
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [phoneReady, setPhoneReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const key = `campustrader-setup-dismissed:${user.id}`;
    let previouslyDismissed = false;
    try { previouslyDismissed = localStorage.getItem(key) === 'yes'; } catch { /* storage may be unavailable */ }
    void Promise.resolve().then(() => { if (active) setDismissed(previouslyDismissed); });
    void getProfileById(user.id).then(({ profile }) => {
      if (!active) return;
      setPhoneReady(Boolean(profile?.phone_number));
      setVerified(Boolean(profile?.verification_status && !['unverified', 'none'].includes(profile.verification_status)));
      setChecked(true);
    });
    return () => { active = false; };
  }, [user]);

  if (loading || !user || dismissed || !checked) return null;
  const steps = [
    { label: 'Account created', done: true, href: '/profile' },
    { label: 'Add WhatsApp number', done: phoneReady, href: '/profile?setup=contact' },
    { label: 'Verify your profile', done: verified, href: '/profile?setup=verification' },
    { label: 'Post your first listing', done: false, href: '/sell' },
  ];
  const completed = steps.filter(s => s.done).length;
  const dismiss = () => {
    try { localStorage.setItem(`campustrader-setup-dismissed:${user.id}`, 'yes'); } catch { /* local state still dismisses */ }
    setDismissed(true);
  };

  return (
    <aside aria-label="CampusTrader setup" className="fixed bottom-24 right-3 z-40 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl dark:border-[var(--border)] dark:bg-[var(--surface)] sm:right-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">Your CampusTrader setup</span>
          <span className="text-xs font-bold text-[var(--brand)]">{Math.round(completed / steps.length * 100)}%</span>
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss CampusTrader setup" title="Dismiss setup" className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${completed / steps.length * 100}%` }} /></div>
      {expanded && <div className="mt-2 divide-y divide-[var(--border)]">
        {steps.map(step => <Link key={step.label} href={step.href} className="flex items-center gap-2 py-2 text-xs text-[var(--foreground)]">
          <CheckCircle2 className={`h-4 w-4 shrink-0 ${step.done ? 'text-emerald-600' : 'text-[var(--muted)]'}`} />
          <span className="flex-1">{step.label}</span><ChevronRight className="h-3.5 w-3.5" />
        </Link>)}
        <Link href="/help" className="block pt-2 text-xs font-semibold text-[var(--brand)]">How CampusTrader works</Link>
      </div>}
    </aside>
  );
}
