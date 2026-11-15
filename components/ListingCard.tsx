'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Package } from 'lucide-react';
import type { Listing } from '../lib/listings';

export default function ListingCard({ listing, showCampus = false }: { listing: Listing; showCampus?: boolean }) {
  const firstImage = Array.isArray(listing.media_urls) ? listing.media_urls[0] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(firstImage) && !imageFailed;
  const priceLabel = listing.price != null && listing.price > 0
    ? 'KSh ' + listing.price.toLocaleString('en-KE')
    : 'Price on enquiry';
  const sellerLabel = listing.sellerType === 'business'
    ? listing.sellerName || 'Campus business'
    : listing.sellerName || 'CampusTrader member';

  return (
    <Link
      href={'/listing/' + listing.id}
      prefetch={false}
      aria-label={'View ' + listing.title}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
        {showImage ? (
          <img
            src={firstImage || ''}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
            <Package className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[10px] font-medium uppercase tracking-wide">{listing.category}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm dark:bg-slate-950/90 dark:text-slate-200">
            {listing.condition === 'new' ? 'New' : listing.condition === 'refurbished' ? 'Refurbished' : 'Used'}
          </span>
          {listing.reviewed_at ? (
            <span className="rounded-md bg-emerald-700/95 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
              Reviewed
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{listing.category}</p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-slate-900 sm:text-sm dark:text-white">
          {listing.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-base font-bold tracking-tight text-slate-950 dark:text-white">{priceLabel}</p>
          {listing.price != null && listing.price > 0 ? (
            <span className={listing.negotiable
              ? 'text-[10px] font-semibold text-emerald-700 dark:text-emerald-300'
              : 'text-[10px] font-medium text-slate-500 dark:text-slate-400'}>
              {listing.negotiable ? 'Negotiable' : 'Fixed price'}
            </span>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-2 min-h-9 text-[11px] leading-[1.15rem] text-slate-600 dark:text-slate-400">
          {listing.description?.trim() || 'Open the listing for more product details.'}
        </p>
        <div className="mt-auto pt-3">
          <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <span className="min-w-0 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">{sellerLabel}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
              View details
              <span aria-hidden="true">→</span>
            </span>
          </div>
          {showCampus && listing.campus ? (
            <p className="mt-1.5 truncate text-[10px] font-semibold text-blue-700 dark:text-blue-300">
              {listing.campus === 'MUKIRIA' ? 'Mukiria TTI' : listing.campus}
            </p>
          ) : null}
          {listing.location ? (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-500 dark:text-slate-400">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              {listing.location}
            </p>
          ) : null}
        </div>
        <span className="sr-only">View listing</span>
      </div>
    </Link>
  );
}
