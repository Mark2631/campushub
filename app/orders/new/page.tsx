import Link from 'next/link';
import { ArrowLeft, MapPin, ShieldCheck } from 'lucide-react';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import OrderCheckoutForm from '../../../components/OrderCheckoutForm';
import { getListingById } from '../../../lib/listings';
import { isDirectPurchaseListing } from '../../../lib/orders';
import { isValidUuid } from '../../../lib/validation';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ listing?: string }> };

function Notice({ children, tone = 'amber' }: { children: React.ReactNode; tone?: 'amber' | 'blue' }) {
  const colors = tone === 'blue'
    ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100'
    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100';
  return <section role="status" className={`rounded-3xl border p-5 text-sm leading-6 ${colors}`}>{children}</section>;
}

export default async function NewOrderPage({ searchParams }: Props) {
  const { listing: listingId } = await searchParams;
  const listingResult = listingId && isValidUuid(listingId)
    ? await getListingById(listingId)
    : { listing: null, error: null };
  const listing = listingResult.listing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:from-black dark:to-zinc-950 dark:text-white">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
        <Link href={listing ? `/listing/${listing.id}` : '/'} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to listing
        </Link>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Order request</p>
          <h1 className="mt-2 text-3xl font-bold">How would you like to transact?</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">Choose direct payment or optional CampusTrader protection, then choose pickup or D-Delivery.</p>
        </div>

        {!listing ? (
          <Notice>This listing could not be loaded. Return to the marketplace and choose an available listing.</Notice>
        ) : (
          <div className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">Product</p>
                  <h2 className="mt-2 text-xl font-bold">{listing.title}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Seller: {listing.sellerName || 'CampusTrader seller'}</p>
                </div>
                <p className="shrink-0 text-lg font-bold text-blue-600 dark:text-blue-300">KSh {Number(listing.price ?? 0).toLocaleString('en-KE')}</p>
              </div>
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                <MapPin className="h-4 w-4 text-blue-500" aria-hidden="true" /> {listing.location || 'Campus location'}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <ShieldCheck className="h-4 w-4 text-blue-500" aria-hidden="true" /> Protected order · seller settlement follows the configured completion workflow
              </div>
            </section>

            {!isDirectPurchaseListing(listing) ? (
              <Notice>This listing is not enabled for ordering. You can still message or contact the seller from the listing page.</Notice>
            ) : (
              <OrderCheckoutForm
                listingId={listing.id}
                sellerId={listing.seller_id}
                listingPrice={Number(listing.price)}
                listingCampus={listing.campus || 'MUST'}
              />
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
