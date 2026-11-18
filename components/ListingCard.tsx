'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, MapPin, PackageOpen, Store } from 'lucide-react';
import type { Listing } from '../lib/listings';

export default function ListingCard({ listing }: { listing: Listing }) {
  const firstImage = Array.isArray(listing.media_urls) ? listing.media_urls[0] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(firstImage) && !imageFailed;
  const price = listing.price != null && listing.price > 0 ? 'KSh ' + listing.price.toLocaleString('en-KE') : 'Ask seller for price';
  const verified = listing.badgeType === 'gold' || listing.badgeType === 'blue' || listing.badgeType === 'admin';

  return (
    <Link href={'/listing/' + listing.id} prefetch={false} aria-label={'View ' + listing.title} className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)]/45 hover:shadow-[0_12px_34px_rgba(18,45,30,.10)] active:scale-[.99]">
      <div className="relative aspect-square overflow-hidden bg-[var(--surface-muted)]">
        {showImage ? <img src={firstImage || ''} alt={listing.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" onError={() => setImageFailed(true)} /> : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--muted)]">
            <PackageOpen className="h-8 w-8 opacity-50" strokeWidth={1.35} aria-hidden="true" />
            <span className="max-w-[85%] text-center text-[10px] font-semibold uppercase tracking-[0.12em]">{listing.category || 'Campus listing'}</span>
          </div>
        )}
        {listing.condition ? <span className="absolute left-2.5 top-2.5 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur">{listing.condition}</span> : null}
        {listing.business_id ? <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 p-1.5 text-[var(--brand)] shadow-sm"><Store className="h-3.5 w-3.5" aria-label="Business seller" /></span> : null}
      </div>
      <div className="flex min-h-[118px] flex-1 flex-col p-3 sm:p-3.5">
        <p className="line-clamp-2 min-h-[2.45rem] text-[12px] font-semibold leading-[1.25rem] text-[var(--foreground)] sm:text-[13px]">{listing.title}</p>
        <p className="mt-2 text-[14px] font-extrabold tracking-[-0.025em] text-[var(--brand)] sm:text-[15px]">{price}</p>
        <div className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-2.5">
          <span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-[var(--muted)]"><MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{listing.location || listing.campus || 'Campus pickup'}</span></span>
          {verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" aria-label="Verified seller" /> : null}
        </div>
        {listing.sellerName ? <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{listing.sellerName}</p> : null}
        <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--brand)]">View listing <ArrowRight className="h-3 w-3" /></span>
      </div>
    </Link>
  );
}
