import Link from 'next/link';
import { Store } from 'lucide-react';

type LogoProps = {
  compact?: boolean;
  href?: string;
};

export default function Logo({ compact = false, href = '/' }: LogoProps) {
  const content = (
    <span className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/10 dark:bg-white dark:text-slate-950">
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-950" />
        <Store className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl dark:text-white">CampusTrader</span>
          <span className="hidden text-xs font-semibold text-slate-500 sm:block dark:text-slate-400">Trusted Campus Marketplace</span>
        </span>
      ) : null}
    </span>
  );

  return (
    <Link href={href} className="hover:opacity-90 transition">
      {content}
    </Link>
  );
}
