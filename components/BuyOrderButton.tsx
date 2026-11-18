import Link from 'next/link';

export default function BuyOrderButton({ listingId }: { listingId: string }) {
  return (
    <div className="space-y-2">
      <Link
        href={`/orders/new?listing=${encodeURIComponent(listingId)}`}
        className="flex w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        Request to buy
      </Link>
      <p className="text-center text-xs leading-5 text-[var(--muted)]">
        This sends an order request. It does not charge you or confirm payment.
      </p>
    </div>
  );
}
