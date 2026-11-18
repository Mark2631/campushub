import Link from 'next/link';
import BrandMark from './BrandMark';

type LogoProps = { compact?: boolean; href?: string };

export default function Logo({ compact = false, href = '/' }: LogoProps) {
  return (
    <Link href={href} aria-label="CampusTrader home" className="inline-flex min-w-0 items-center gap-2.5">
      <BrandMark size={compact ? 36 : 40} title="CampusTrader" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[17px] font-extrabold tracking-[-0.045em] text-[var(--foreground)] sm:text-[19px]">CampusTrader</span>
        {!compact ? <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] sm:block">Your campus marketplace</span> : null}
      </span>
    </Link>
  );
}
