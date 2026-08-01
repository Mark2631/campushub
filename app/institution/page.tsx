'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import useUser from '../../hooks/useUser';
import { getInstitutions, Institution, saveUserInstitution } from '../../lib/institutions';
import { ensureProfile, getProfileById } from '../../lib/profiles';

function InstitutionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const { user, loading, showToast } = useUser();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [fetching, setFetching] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { institutions: rows, error } = await getInstitutions();
      if (!mounted) return;
      if (error) setMessage(error);
      setInstitutions(rows);
      setFetching(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const verifyProfile = async () => {
      if (loading) return;
      if (!user) {
        router.replace(`/signin?next=${encodeURIComponent('/institution')}&mode=signin`);
        return;
      }

      await ensureProfile(user);
      const { profile } = await getProfileById(user.id);
      if (mounted && profile?.institution_id) {
        router.replace(next);
      }
    };

    void verifyProfile();

    return () => {
      mounted = false;
    };
  }, [loading, next, router, user]);

  const selectInstitution = async (institution: Institution) => {
    if (!user || institution.status !== 'active') return;

    setSavingId(institution.id);
    setMessage(null);
    const { error } = await saveUserInstitution(user.id, institution.id);
    setSavingId(null);

    if (error) {
      setMessage(error);
      showToast({ type: 'error', message: error });
      return;
    }

    showToast({ type: 'success', message: `${institution.short_name} selected.` });
    router.replace(next);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col justify-center px-4 py-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">CampusTrader onboarding</p>
          <h1 className="mt-3 text-2xl font-black sm:text-4xl">Choose your institution</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            CampusTrader shows marketplace posts, requests, communities, and businesses from your institution first. You must choose an active institution before entering the marketplace.
          </p>

          {message ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {fetching ? (
              Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)
            ) : institutions.length > 0 ? (
              institutions.map((institution) => {
                const active = institution.status === 'active';
                return (
                  <button
                    key={institution.id}
                    type="button"
                    disabled={!active || savingId === institution.id}
                    onClick={() => selectInstitution(institution)}
                    className={`rounded-2xl border p-4 text-left transition ${active ? 'border-blue-200 bg-blue-50 hover:border-blue-400 dark:border-blue-900 dark:bg-blue-950/40' : 'border-slate-200 bg-slate-50 opacity-75 dark:border-slate-800 dark:bg-slate-950'}`}
                  >
                    <span className="text-lg font-black">{institution.short_name}</span>
                    <span className={`ml-2 rounded-full px-2 py-1 text-[10px] font-black uppercase ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                      {active ? 'Active' : 'Coming soon'}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">{institution.name}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{institution.county} County</span>
                  </button>
                );
              })
            ) : (
              <p className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">No institutions are available yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function InstitutionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <InstitutionPageContent />
    </Suspense>
  );
}
