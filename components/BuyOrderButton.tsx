'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function BuyOrderButton({ listingId }: { listingId: string }) {
  return (
    <Link
      href={`/orders/new?listing=${encodeURIComponent(listingId)}`}
      aria-label="Continue to order"
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/40 bg-blue-600/90 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      <span>Buy / order</span>
      <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
