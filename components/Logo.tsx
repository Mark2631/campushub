import Link from 'next/link';

type LogoProps = {
  compact?: boolean;
  href?: string;
};

export default function Logo({ compact = false, href = '/' }: LogoProps) {
  const content = (
    <span className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-emerald-500 text-sm font-black text-white shadow-lg shadow-blue-500/20">
        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-white/80" />
        <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-white/80" />
        <span className="absolute h-5 w-5 rounded-full border border-white/40" />
        <span>CT</span>
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
