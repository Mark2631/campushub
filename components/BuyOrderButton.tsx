'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function BuyOrderButton({ listingId }: { listingId: string }) {
  return (
    <Link
      href={`/orders/new?listing=${encodeURIComponent(listingId)}`}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      Buy / order
      <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
