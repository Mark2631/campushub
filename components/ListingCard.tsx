'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import Link from 'next/link';
import type { Listing } from '../lib/listings';

export default function ListingCard({ listing }: { listing: Listing }) {
  const firstImage = Array.isArray(listing.media_urls) ? listing.media_urls[0] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(firstImage) && !imageFailed;
  const price = listing.price != null && listing.price > 0
    ? `KSh ${listing.price.toLocaleString('en-KE')}`
    : 'Ask CampusTrader for price';

  return (
    <Link
      href={`/listing/${listing.id}`}
      prefetch={false}
      aria-label={`View ${listing.title}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {showImage ? (
          <img
            src={firstImage || '/placeholder-image.png'}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wide">{listing.category}</span>
            <span className="mt-1 text-[11px]">No photo added</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{listing.category}</span>
          <span className="shrink-0 text-[10px] capitalize text-slate-500 dark:text-slate-400">{listing.condition}</span>
        </div>

        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-950 dark:text-slate-50">{listing.title}</h3>

        <p className="mt-2 text-base font-bold text-slate-950 dark:text-white">{price}</p>

        <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-4 text-slate-600 dark:text-slate-300">
          {listing.description?.trim() || 'Open the listing for more details.'}
        </p>

        <div className="mt-3 flex min-h-5 items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="truncate">{listing.location || 'Campus location'}</span>
          <span className="shrink-0">{listing.sellerType === 'business' ? 'Business' : 'Student'}</span>
        </div>

        {listing.sellerRatingCount ? (
          <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300" aria-label={`Seller rating ${listing.sellerRatingAverage?.toFixed(1)} out of 5 from ${listing.sellerRatingCount} reviews`}>
            ★ {listing.sellerRatingAverage?.toFixed(1)} <span className="font-normal text-slate-500 dark:text-zinc-400">({listing.sellerRatingCount})</span>
          </p>
        ) : null}

        <span className="mt-auto pt-3 text-xs font-semibold text-blue-700 dark:text-blue-300">View listing <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}
