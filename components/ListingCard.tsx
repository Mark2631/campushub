'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import Link from 'next/link';
import type { Listing } from '../lib/listings';

function conditionLabel(condition: string) {
  const value = condition.trim().toLowerCase();
  if (value === 'new') return 'New';
  if (value === 'refurbished') return 'Refurbished';
  if (value === 'service') return 'Service';
  return 'Pre-owned';
}

function verificationLabel(badgeType: Listing['badgeType']) {
  if (badgeType === 'gold') return 'Verified business';
  if (badgeType === 'blue') return 'Verified student';
  if (badgeType === 'admin') return 'CampusTrader admin';
  return null;
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const firstImage = Array.isArray(listing.media_urls) ? listing.media_urls[0] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(firstImage) && !imageFailed;
  const verifiedLabel = verificationLabel(listing.badgeType);
  const sellerName = listing.sellerName?.trim() || (listing.sellerType === 'business' ? 'Campus business' : 'Campus seller');
  const isService = listing.listing_type === 'SERVICE_ENQUIRY' || listing.condition === 'service';

  return (
    <Link
      href={`/listing/${listing.id}`}
      prefetch={false}
      aria-label={`View ${listing.title}, ${listing.price != null && listing.price > 0 ? `KSh ${listing.price.toLocaleString('en-KE')}` : 'price on request'}`}
      className="group flex min-h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-400 hover:shadow-sm active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:active:bg-slate-800"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {showImage ? (
          <img
            src={firstImage || '/placeholder-image.png'}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wide">{listing.category}</span>
            <span className="mt-1 text-xs">Image not available</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm dark:bg-slate-950/90 dark:text-slate-200">
          {conditionLabel(listing.condition)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-950 dark:text-slate-50">
          {listing.title}
        </h3>

        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-base font-bold text-blue-700 dark:text-blue-300">
            {listing.price != null && listing.price > 0
              ? `KSh ${listing.price.toLocaleString('en-KE')}`
              : 'Ask seller for price'}
          </p>
          {listing.negotiable ? (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Negotiable</span>
          ) : null}
        </div>

        <div className="mt-2 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          <p className="truncate font-medium text-slate-700 dark:text-slate-200">{sellerName}</p>
          <p className="truncate">{listing.location || 'Campus location'} <span aria-hidden="true">·</span> {listing.category}</p>
        </div>

        <div className="mt-auto flex min-h-7 flex-wrap items-center gap-1.5 pt-2">
          {verifiedLabel ? (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
              {verifiedLabel}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {listing.sellerType === 'business' ? 'Business seller' : 'Student seller'}
            </span>
          )}
          {listing.businessDeliveryAvailable ? (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              Delivery available
            </span>
          ) : null}
          {isService ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Service
            </span>
          ) : null}
        </div>

        <span className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-blue-700">
          View listing
        </span>
      </div>
    </Link>
  );
}
