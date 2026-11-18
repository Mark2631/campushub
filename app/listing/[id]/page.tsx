import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import MessageSellerButton from '../../../components/MessageSellerButton';
import BuyOrderButton from '../../../components/BuyOrderButton';
import ListingInventoryManager from '../../../components/ListingInventoryManager';
import ReportButton from '../../../components/ReportButton';
import SafetyBanner from '../../../components/SafetyBanner';
import SaveListingButton from '../../../components/SaveListingButton';
import WhatsAppButton from '../../../components/WhatsAppButton';
import DeliveryRequestButton from '../../../components/DeliveryRequestButton';
import { getListingById, getListings } from '../../../lib/listings';
import { listingBelongsToCategory } from '../../../lib/categories';
import HelpContactAction from '../../../components/HelpContactAction';
import ListingCard from '../../../components/ListingCard';
import ListingMediaGallery from '../../../components/ListingMediaGallery';
import { isValidUuid } from '../../../lib/validation';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const siteUrl = 'https://campus-trader.vercel.app';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { listing } = isValidUuid(id)
    ? await getListingById(id)
    : { listing: null };

  if (!listing) {
    return {
      title: 'Listing unavailable | CampusTrader',
      robots: { index: false, follow: false },
    };
  }

  const title = `${listing.title} | CampusTrader`;
  const rawDescription = typeof listing.description === 'string'
    ? listing.description.split(String.fromCharCode(10)).join(' ').split(String.fromCharCode(13)).join(' ').split(String.fromCharCode(9)).join(' ').trim()
    : '';
  const listingDetails = [
    typeof listing.condition === 'string' ? listing.condition.toLowerCase() : '',
    typeof listing.category === 'string' ? listing.category.toLowerCase() : '',
    typeof listing.location === 'string' && listing.location.trim() ? `in ${listing.location.trim()}` : 'on campus in Kenya',
    listing.price != null && Number.isFinite(Number(listing.price)) && Number(listing.price) > 0
      ? `KSh ${Number(listing.price).toLocaleString('en-KE')}`
      : '',
  ].filter(Boolean).join(' · ');
  const fallbackDescription = `${listing.title}: ${listingDetails}. Listed on CampusTrader.`;
  const description = (rawDescription || fallbackDescription).slice(0, 160);
  const url = `${siteUrl}/listing/${listing.id}`;
  const images = Array.isArray(listing.media_urls)
    ? listing.media_urls.filter((item): item is string => typeof item === 'string' && (item.startsWith('https://') || item.startsWith('http://'))).slice(0, 4)
    : [];
  const socialImages = images.length
    ? images.map((url) => ({ url, alt: listing.title }))
    : [{ url: `${siteUrl}/opengraph-image`, alt: 'CampusTrader student marketplace in Kenya' }];
  const indexable = listing.status === 'active' && listing.title.trim().length >= 4;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: indexable, follow: true },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: 'CampusTrader',
      images: socialImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: socialImages.map((image) => image.url),
    },
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const { listing, error } = isValidUuid(id)
    ? await getListingById(id)
    : { listing: null, error: null };

  if (error || !listing) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)] pb-24 text-[var(--foreground)]">
        <Header />
        <main className="flex-1 px-4 py-20 text-center">
          <div className="mx-auto max-w-md rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-10 dark:border-[var(--border)] dark:bg-[var(--surface)]">
            <h1 className="mb-4 text-3xl font-bold text-[var(--foreground)]">Listing not found</h1>
            <p className="text-[var(--muted)]">This listing is unavailable.</p>
            <Link href="/sell" className="mt-5 inline-block rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]">
              Post listing
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const formattedDate = new Date(listing.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const mediaUrls = Array.isArray(listing.media_urls) ? listing.media_urls : [];
  const productImages = mediaUrls.filter((item): item is string => typeof item === 'string' && (item.startsWith('https://') || item.startsWith('http://')));
  const { listings: relatedCandidates } = listing.status === 'active'
    ? await getListings(24, 0, listing.campus || 'MUST')
    : { listings: [] as Awaited<ReturnType<typeof getListings>>['listings'] };
  const relatedListings = relatedCandidates
    .filter((candidate) => candidate.id !== listing.id && candidate.status === 'active' && listingBelongsToCategory(candidate, listing.category))
    .slice(0, 5);
  const conditionUrl = listing.condition === 'new'
    ? 'https://schema.org/NewCondition'
    : listing.condition === 'refurbished'
      ? 'https://schema.org/RefurbishedCondition'
      : 'https://schema.org/UsedCondition';
  const productStructuredData = listing.status === 'active'
    && listing.listing_type === 'PHYSICAL_PRODUCT'
    && typeof listing.price === 'number'
    && Number.isFinite(listing.price)
    && listing.price >= 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: listing.title,
        description: listing.description || `${listing.title} listed on CampusTrader.`,
        category: listing.category,
        ...(productImages.length ? { image: productImages } : {}),
        offers: {
          '@type': 'Offer',
          url: `${siteUrl}/listing/${listing.id}`,
          price: listing.price,
          priceCurrency: 'KES',
          availability: 'https://schema.org/InStock',
          itemCondition: conditionUrl,
        },
      }
    : null;

  const fallbackPanel = (
    <div className="flex min-h-80 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center text-[var(--foreground)] dark:border-[var(--border)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em]">{listing.category}</p>
        <p className="mt-3 text-2xl font-bold">{listing.title}</p>
        <p className="mt-2 text-sm text-white/75">Listing preview for items without uploaded media.</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] pb-24 text-[var(--foreground)]">
      {productStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData).replace(/</g, '\\u003c') }}
        />
      ) : null}
      <Header />
      <main className="flex-1 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 md:p-8">
            <div className="mb-6 sm:mb-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand)]">{listing.category}</p>
              <h1 className="mt-3 text-2xl font-bold text-[var(--foreground)] sm:text-3xl md:text-4xl dark:text-[var(--foreground)]">{listing.title}</h1>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-5">
                {productImages.length > 0 ? (
                  <ListingMediaGallery images={productImages} title={listing.title} />
                ) : (
                  fallbackPanel
                )}

                {listing.video_url ? (
                  <video src={listing.video_url} controls className="w-full rounded-2xl bg-black" />
                ) : null}

                <SafetyBanner compact />
              </div>

              <div className="space-y-6">
                {listing.status === 'sold' ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--foreground)]">
                    This listing has been marked as sold.
                  </div>
                ) : null}

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand)]">Price</p>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--brand)] sm:text-4xl">
                    {listing.price != null && listing.price > 0 ? `KSh ${listing.price.toLocaleString()}` : 'Ask seller for price'}
                  </p>
                  {listing.negotiable ? <p className="mt-2 text-sm font-semibold text-[var(--brand)] dark:text-[var(--brand)]">Negotiable</p> : null}
                </div>

                <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--muted)]">Category</p>
                    <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{listing.category}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--muted)]">Condition</p>
                    <p className="mt-2 text-lg font-bold capitalize text-[var(--foreground)]">{listing.condition}</p>
                  </div>
                  <div className="border-t border-[var(--border)] pt-4 dark:border-[var(--border)]">
                    <p className="text-sm font-semibold text-[var(--muted)]">Location</p>
                    <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{listing.location || 'Campus location'}</p>
                  </div>
                  <div className="border-t border-[var(--border)] pt-4 dark:border-[var(--border)]">
                    <p className="text-sm font-semibold text-[var(--muted)]">Posted</p>
                    <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{formattedDate}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <p className="text-sm font-semibold text-[var(--muted)]">Description</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{listing.description || 'No description provided.'}</p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <p className="text-sm font-semibold text-[var(--muted)]">Seller</p>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)] text-lg font-bold text-[var(--brand)]">
                      {listing.sellerAvatarUrl ? (
                        <Image src={listing.sellerAvatarUrl} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        (listing.sellerName || 'Seller').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[var(--foreground)]">{listing.sellerName || 'CampusTrader seller'}</p>
                        {listing.badgeType === 'gold' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                            Gold tick
                          </span>
                        ) : listing.badgeType === 'admin' ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                            Admin
                          </span>
                        ) : listing.badgeType === 'blue' ? (
                          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--brand)]">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {listing.sellerType === 'business'
                          ? 'Nearby campus business'
                          : listing.badgeType === 'blue' || listing.badgeType === 'admin'
                            ? 'Verified CampusTrader seller'
                            : 'CampusTrader seller'}
                      </p>
                      {listing.sellerSince ? (
                        <p className="mt-1 text-xs text-[var(--muted)] dark:text-[var(--muted)]">Member since {new Date(listing.sellerSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <ListingInventoryManager listingId={listing.id} sellerId={listing.seller_id} listingStatus={listing.status} />
                  {listing.status === 'sold' ? (
                    <button className="w-full rounded-2xl bg-gray-300 px-5 py-4 text-sm font-semibold text-[var(--foreground)] dark:bg-[var(--surface-muted)] dark:text-[var(--foreground)]" disabled>
                      Sold
                    </button>
                  ) : (
                    <>
                      {listing.status === 'active' && listing.listing_type === 'PHYSICAL_PRODUCT' && typeof listing.price === 'number' && Number.isFinite(listing.price) && listing.price > 0 ? <BuyOrderButton listingId={listing.id} /> : null}
                      <MessageSellerButton listingId={listing.id} sellerId={listing.seller_id} />
                      <WhatsAppButton listingId={listing.id} />
                      {listing.business_id && listing.businessDeliveryAvailable && listing.status === 'active' ? (
                        <DeliveryRequestButton listingId={listing.id} listingTitle={listing.title} businessId={listing.business_id} sellerId={listing.seller_id} pickupLocation={listing.location || 'MUST'} />
                      ) : null}
                      <p className="text-xs leading-5 text-[var(--muted)] dark:text-[var(--muted)]">Use WhatsApp only when you are comfortable. Avoid advance payments before inspection.</p>
                    </>
                  )}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"><p className="text-sm font-semibold">Need help checking this item or arranging delivery?</p><HelpContactAction /></div>
                  <SaveListingButton listingId={listing.id} />
                  <ReportButton targetType="listing" targetId={listing.id} />
                </div>
              </div>
            </div>
          </div>
          {relatedListings.length > 0 ? (
              <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand)]">Keep exploring</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-[-0.04em]">More in {listing.category}</h2>
                    <p className="mt-1 text-xs text-[var(--muted)]">Other listings from your campus marketplace.</p>
                  </div>
                  <Link href={'/?category=' + encodeURIComponent(listing.category)} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--brand)] hover:underline">View category <ChevronRight className="h-3.5 w-3.5" /></Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {relatedListings.map((related) => <ListingCard key={related.id} listing={related} />)}
                </div>
              </section>
            ) : null}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
