import Link from 'next/link';

export default function BuyOrderButton({ listingId }: { listingId: string }) {
  return (
    <div className="space-y-2">
      <Link
        href={`/orders/new?listing=${encodeURIComponent(listingId)}`}
        className="flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-4 text-sm font-extrabold text-[var(--foreground)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        Request to buy
      </Link>
      <p className="text-center text-xs leading-5 text-[var(--muted)]">
        The seller confirms availability before you arrange payment.
      </p>
    </div>
  );
}
