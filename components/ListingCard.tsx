'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Listing } from '../lib/listings';

export default function ListingCard({ listing }: { listing: Listing }) {
  const firstImage = Array.isArray(listing.media_urls) ? listing.media_urls[0] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(firstImage) && !imageFailed;

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-emerald-500/50 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 text-sm text-slate-500 dark:from-slate-800 dark:to-slate-700 dark:text-slate-500">
        {showImage ? (
          <Image
            src={firstImage || ''}
            alt={listing.title}
<<<<<<< HEAD
            fill
=======
            width={400}
            height={400}
>>>>>>> d29aa1d6778749e57331dc28811ef12c8fa90459
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="h-full w-full object-cover transition group-hover:scale-105"
            onError={() => setImageFailed(true)}
            unoptimized
          />
        ) : (
<<<<<<< HEAD
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-500 to-slate-900 px-3 text-center text-white">
            <span className="text-[10px] font-black uppercase tracking-wide">{listing.category}</span>
=======
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 px-3 text-center text-white">
            <span className="text-[10px] font-semibold uppercase tracking-wide">{listing.category}</span>
>>>>>>> d29aa1d6778749e57331dc28811ef12c8fa90459
            <span className="mt-1 text-xs font-bold">{listing.sellerType === 'business' ? 'Verified seller' : 'Campus listing'}</span>
          </div>
        )}
      </div>
<<<<<<< HEAD
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-5 text-slate-900 sm:text-sm dark:text-white">{listing.title}</h3>
        <p className="mt-1 text-sm font-black text-emerald-600 sm:text-base dark:text-emerald-400">
=======
      <div className="p-2.5 sm:p-3">
        <h3 className="line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-5 text-gray-900 sm:text-sm dark:text-white">{listing.title}</h3>
        <p className="mt-1 text-sm font-semibold text-blue-600 sm:text-base dark:text-blue-400">
>>>>>>> d29aa1d6778749e57331dc28811ef12c8fa90459
          {listing.price != null ? `KSh ${listing.price.toLocaleString()}` : 'Free'}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-400">{listing.location || 'Campus location'}</p>
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
          <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">{listing.category}</span>
        </div>
      </div>
    </Link>
  );
}
