import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import MessageSellerButton from '../../../components/MessageSellerButton';
import BuyOrderButton from '../../../components/BuyOrderButton';
import ListingInventoryManager from '../../../components/ListingInventoryManager';
import ReportButton from '../../../components/ReportButton';
import SafetyBanner from '../../../components/SafetyBanner';
import SaveListingButton from '../../../components/SaveListingButton';
import WhatsAppButton from '../../../components/WhatsAppButton';
import { getListingById } from '../../../lib/listings';
import { isDirectPurchaseListing } from '../../../lib/orders';
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
    : { listing: null, error: null };

  if (!listing) {
    return {
      title: 'Listing unavailable | CampusTrader',
      robots: { index: false, follow: false },
    };
  }

  const title = `${listing.title} | CampusTrader`;
  const rawDescription = typeof listing.description === 'string'
    ? listing.description.replaceAll('\\n', ' ').replaceAll('\\r', ' ').replaceAll('\\t', ' ').trim()
    : '';
  const description = (rawDescription || `View this ${listing.category.toLowerCase()} listing on CampusTrader.`).slice(0, 160);
  const url = `${siteUrl}/listing/${listing.id}`;
  const images = Array.isArray(listing.media_urls)
    ? listing.media_urls.filter((item): item is string => typeof item === 'string' && (item.startsWith('https://') || item.startsWith('http://'))).slice(0, 4)
    : [];
  const socialImages = images.length
    ? images.map((url) => ({ url, alt: listing.title }))
    : [{ url: `${siteUrl}/opengraph-image`, alt: 'CampusTrader student marketplace in Kenya' }];
  const hasSubstantialDescription = rawDescription.length >= 40;
  const indexable = listing.status === 'active' && listing.title.trim().length >= 4 && hasSubstantialDescription;

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
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 dark:text-white">
        <Header />
        <main className="flex-1 px-4 py-20 text-center">
          <div className="mx-auto max-w-md rounded-2xl border-2 border-gray-300 bg-white p-10 dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">Listing not found</h1>
            <p className="text-gray-600 dark:text-zinc-400">This listing is unavailable.</p>
            <Link href="/sell" className="mt-5 inline-block rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
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
  const canStartOrder = isDirectPurchaseListing(listing);
  const fallbackPanel = (
    <div className="flex min-h-80 items-center justify-center rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-700 to-slate-900 p-8 text-center text-white dark:border-zinc-800">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em]">{listing.category}</p>
        <p className="mt-3 text-2xl font-bold">{listing.title}</p>
        <p className="mt-2 text-sm text-blue-50/90">Listing preview for items without uploaded media.</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:bg-gradient-to-br dark:from-black dark:to-zinc-950 dark:text-white">
      {productStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData).replace(/</g, '\\u003c') }}
        />
      ) : null}
      <Header />
      <main className="flex-1 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-blue-500/5 sm:p-6 md:p-8">
            <div className="mb-6 sm:mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500">{listing.category}</p>
              <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl dark:text-white">{listing.title}</h1>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-5">
                {mediaUrls.length > 0 ? (
                  <div className="grid gap-3">
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-950">
                      <Image src={mediaUrls[0]} alt={listing.title} width={1200} height={900} className="max-h-[24rem] w-full object-contain sm:max-h-[32rem]" unoptimized />
                    </div>
                    {mediaUrls.length > 1 ? (
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5">
                        {mediaUrls.slice(1).map((url) => (
                          <Image key={url} src={url} alt={listing.title} width={240} height={240} className="h-24 rounded-xl border border-gray-200 object-cover dark:border-zinc-800" unoptimized />
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    This listing has been marked as sold.
                  </div>
                ) : null}

                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 dark:border-zinc-800 dark:from-blue-900/30 dark:to-blue-800/20">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Price</p>
                  <p className="mt-3 text-3xl font-bold text-blue-600 sm:text-4xl dark:text-blue-400">
                    {listing.price != null ? `KSh ${listing.price.toLocaleString()}` : 'Free'}
                  </p>
                  {listing.negotiable ? <p className="mt-2 text-sm font-semibold text-blue-700 dark:text-blue-200">Negotiable</p> : null}
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">Category</p>
                    <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{listing.category}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">Condition</p>
                    <p className="mt-2 text-lg font-bold capitalize text-gray-900 dark:text-white">{listing.condition}</p>
                  </div>
                  <div className="border-t border-gray-200 pt-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">Location</p>
                    <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{listing.location || 'Campus location'}</p>
                  </div>
                  <div className="border-t border-gray-200 pt-4 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">Posted</p>
                    <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{formattedDate}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">Description</p>
                  <p className="mt-3 text-sm leading-7 text-gray-700 dark:text-zinc-300">{listing.description || 'No description provided.'}</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">Seller</p>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-lg font-bold text-white">
                      {listing.sellerAvatarUrl ? (
                        <Image src={listing.sellerAvatarUrl} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        (listing.sellerName || 'Seller').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900 dark:text-white">{listing.sellerName || 'CampusTrader seller'}</p>
                        {listing.badgeType === 'gold' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                            Gold tick
                          </span>
                        ) : listing.badgeType === 'admin' ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                            Admin
                          </span>
                        ) : listing.badgeType === 'blue' ? (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-zinc-400">
                        {listing.sellerType === 'business'
                          ? 'Nearby campus business'
                          : listing.badgeType === 'blue' || listing.badgeType === 'admin'
                            ? 'Verified CampusTrader seller'
                            : 'CampusTrader seller'}
                      </p>
                      {listing.sellerSince ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">Member since {new Date(listing.sellerSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <ListingInventoryManager listingId={listing.id} sellerId={listing.seller_id} listingStatus={listing.status} />
                  {listing.status === 'sold' ? (
                    <button className="w-full rounded-2xl bg-gray-300 px-5 py-4 text-sm font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-300" disabled>
                      Sold
                    </button>
                  ) : (
                    <>
                      {canStartOrder ? (
                        <BuyOrderButton listingId={listing.id} />
                      ) : (
                        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                          {listing.status !== 'active'
                            ? 'This listing is not available for a new protected order.'
                            : 'Protected checkout is available for active, paid products. Message the seller to discuss this listing.'}
                        </p>
                      )}
                      <MessageSellerButton listingId={listing.id} sellerId={listing.seller_id} />
                      <WhatsAppButton userId={listing.seller_id} phoneNumber={listing.sellerPhoneNumber} />
                      <p className="text-xs leading-5 text-gray-500 dark:text-zinc-500">Use WhatsApp only when you are comfortable. Avoid advance payments before inspection.</p>
                    </>
                  )}
                  <SaveListingButton listingId={listing.id} />
                  <ReportButton targetType="listing" targetId={listing.id} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
