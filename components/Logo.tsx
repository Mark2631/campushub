import Link from 'next/link';
import { GraduationCap, ShoppingBag } from 'lucide-react';

type LogoProps = {
  compact?: boolean;
  href?: string;
};

export default function Logo({ compact = false, href = '/' }: LogoProps) {
  const content = (
    <span className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 via-blue-600 to-slate-950 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/15">
        <span className="absolute inset-x-1 top-1 h-4 rounded-full bg-white/20 blur-sm" />
        <ShoppingBag className="relative h-5 w-5" aria-hidden="true" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-xl bg-white text-slate-950 shadow-md ring-1 ring-slate-200 dark:bg-slate-950 dark:text-white dark:ring-white/10">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      {!compact ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl dark:text-white">CampusTrader</span>
          <span className="hidden text-xs font-semibold text-slate-500 sm:block dark:text-slate-400">Student Marketplace</span>
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
