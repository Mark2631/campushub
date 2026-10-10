'use client';

import { Clock3, ShieldCheck } from 'lucide-react';

export default function BuyOrderButton({ listingId: _listingId }: { listingId: string }) {
  return (
    <div
      role="status"
      aria-label="Buy or order coming soon"
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/40 bg-blue-600/80 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      <span>Buy / order</span>
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-blue-50">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        Coming soon
      </span>
    </div>
  );
}
