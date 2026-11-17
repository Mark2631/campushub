export default function BuyOrderButton({ listingId }: { listingId?: string }) {
  void listingId;
  return (
    <button type="button" disabled aria-disabled="true" title="Ordering is coming soon" className="flex w-full cursor-not-allowed items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 text-sm font-semibold text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--muted)]">
      Buy / order · Coming soon
    </button>
  );
}
