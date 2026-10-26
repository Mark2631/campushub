import Link from 'next/link';
import BrandMark from './BrandMark';

type LogoProps = {
  compact?: boolean;
  href?: string;
};

export default function Logo({ compact = false, href = '/' }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label={compact ? 'CampusTrader home' : undefined}
      className="inline-flex min-w-0 items-center gap-3 transition hover:opacity-90"
    >
      <BrandMark
        size={44}
        title={compact ? 'CampusTrader' : undefined}
        className="h-11 w-11 shrink-0"
      />
      {!compact ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl dark:text-white">CampusTrader</span>
          <span className="hidden text-xs font-semibold text-slate-500 sm:block dark:text-slate-400">Student Marketplace</span>
        </span>
      ) : null}
    </Link>
  );
}
