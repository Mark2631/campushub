'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import Link from 'next/link';
import type { Listing } from '../lib/listings';

export default function ListingCard({ listing }: { listing: Listing }) {
  const firstImage = Array.isArray(listing.media_urls) ? listing.media_urls[0] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(firstImage) && !imageFailed;

  return (
    <Link
      href={`/listing/${listing.id}`}
      prefetch={false}
      aria-label={`View ${listing.title}`}
      className="group block min-h-full touch-manipulation overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-blue-300 hover:shadow-md active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 text-sm text-gray-500 dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-500">
        {showImage ? (
          <img
            src={firstImage || '/placeholder-image.png'}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 px-3 text-center text-white">
            <span className="text-[10px] font-semibold uppercase tracking-wide">{listing.category}</span>
            <span className="mt-1 text-xs font-bold">{listing.sellerType === 'business' ? 'Verified seller' : 'Campus listing'}</span>
          </div>
        )}
      </div>
      <div className="p-2.5 sm:p-3">
        <h3 className="line-clamp-2 min-h-[2.25rem] text-xs font-bold leading-5 text-slate-950 sm:text-sm dark:text-slate-50">{listing.title}</h3>
        <p className="mt-1 text-sm font-extrabold text-blue-700 sm:text-base dark:text-cyan-300">
          {listing.price != null ? `KSh ${listing.price.toLocaleString()}` : 'Free'}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">{listing.location || 'Campus location'}</p>
        <div className="mt-2 flex min-h-5 items-center gap-1.5">
          {listing.badgeType === 'gold' ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Gold tick
            </span>
          ) : listing.badgeType === 'admin' ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
              Admin
            </span>
          ) : listing.badgeType === 'blue' ? (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
              Verified
            </span>
          ) : listing.business_id ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Business
            </span>
          ) : null}
          <span className="truncate text-[10px] text-gray-500 dark:text-zinc-500">{listing.category}</span>
        </div>
      </div>
    </Link>
  );
}
