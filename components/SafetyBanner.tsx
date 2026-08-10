export default function SafetyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg ${compact ? 'p-4' : 'p-4 sm:p-5'}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sm font-semibold uppercase tracking-wide">Safe</span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold sm:text-base">Trade safely on CampusTrader</h3>
          <p className="mt-1 text-sm text-blue-100">Meet in public. Inspect before paying. Avoid advance payments.</p>
        </div>
      </div>
    </div>
  );
}
