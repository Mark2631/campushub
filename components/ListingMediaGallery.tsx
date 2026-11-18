'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type Props = {
  images: string[];
  title: string;
};

export default function ListingMediaGallery({ images, title }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  if (!images.length) return null;

  const selectImage = (index: number) => {
    setActiveIndex(index);
    setImageFailed(false);
  };

  const move = (direction: -1 | 1) => {
    const nextIndex = (activeIndex + direction + images.length) % images.length;
    selectImage(nextIndex);
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)]">
        {imageFailed ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--muted)]">This listing photo could not be loaded.</div>
        ) : (
          <Image
            src={images[activeIndex]}
            alt={title}
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-contain"
            unoptimized
            onError={() => setImageFailed(true)}
          />
        )}
        {images.length > 1 ? (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => move(-1)} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-800 shadow-sm transition hover:bg-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => move(1)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-800 shadow-sm transition hover:bg-white">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">{activeIndex + 1} / {images.length}</span>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.map((image, index) => (
            <button
              key={image + index}
              type="button"
              aria-label={`View photo ${index + 1}`}
              aria-pressed={activeIndex === index}
              onClick={() => selectImage(index)}
              className={`relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl border-2 bg-[var(--surface-muted)] transition sm:h-[88px] sm:w-[88px] ${activeIndex === index ? 'border-[var(--brand)] shadow-sm' : 'border-[var(--border)] opacity-75 hover:opacity-100'}`}
            >
              <Image src={image} alt="" fill sizes="88px" className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
