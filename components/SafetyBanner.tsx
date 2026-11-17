import { ShieldCheck } from 'lucide-react';

export default function SafetyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className={'flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] ' + (compact ? 'p-3' : 'px-4 py-3.5')}>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" /></span>
      <div className="min-w-0">
        <h3 className="text-[12px] font-bold text-[var(--foreground)]">Trade safely, meet locally</h3>
        <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">Inspect items in person and meet in a public campus location. Never pay in advance to an unknown seller.</p>
      </div>
    </div>
  );
}
