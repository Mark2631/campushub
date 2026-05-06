'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Listing } from '../lib/listings';

export default function ListingCard({ listing }: { listing: Listing }) {
  const firstImage = Array.isArray(listing.media_urls) ? listing.media_urls[0] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(firstImage) && !imageFailed;
  const isLaunchListing = listing.sellerName === 'CampusTrader Admin';

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-blue-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-600 dark:hover:shadow-blue-500/10"
    >
      <div className="flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 text-sm text-gray-500 dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-500">
        {showImage ? (
          <img
            src={firstImage || ''}
            alt={listing.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-sky-500 to-emerald-500 px-4 text-center text-white">
            <span className="text-xs font-black uppercase tracking-[0.24em]">{listing.category}</span>
            <span className="mt-2 text-lg font-bold">{listing.sellerType === 'business' ? 'Verified seller picks' : 'Campus listing'}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
            {listing.category} · {listing.condition}
          </span>
          {isLaunchListing ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
              Launch listing
            </span>
          ) : listing.business_id ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Business
            </span>
          ) : null}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">{listing.title}</h3>
        <p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">{listing.location || 'Campus location'}</p>
        <div className="mt-2 flex items-center gap-2">
          {isLaunchListing ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
              Admin / Verified
            </span>
          ) : listing.badgeType === 'gold' ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Gold tick
            </span>
          ) : listing.badgeType === 'blue' ? (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
              Verified
            </span>
          ) : null}
          {listing.sellerName ? <span className="truncate text-[11px] text-gray-500 dark:text-zinc-500">{listing.sellerName}</span> : null}
        </div>
        {listing.negotiable ? (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Negotiable</p>
        ) : null}
        <p className="mt-3 text-lg font-bold text-blue-600 dark:text-blue-400">
          {listing.price != null ? `KSh ${listing.price.toLocaleString()}` : 'Free'}
        </p>
      </div>
    </Link>
  );
}
