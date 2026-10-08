'use client';

import Link from 'next/link';
import useUser from '../hooks/useUser';

const supportPath = '/profile?manage=help#manage-help';

export default function HelpContactAction() {
  const { user, loading } = useUser();

  if (loading) {
    return <p role="status" className="mt-4 text-sm text-slate-500 dark:text-slate-400">Checking your account…</p>;
  }

  const href = user
    ? supportPath
    : `/signin?mode=signin&next=${encodeURIComponent(supportPath)}`;

  return (
    <Link
      href={href}
      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
    >
      {user ? 'Open the report issue form' : 'Sign in to contact support'}
    </Link>
  );
}
