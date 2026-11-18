import Link from 'next/link';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import OrderCheckoutForm from '../../../components/OrderCheckoutForm';
import { getListingById } from '../../../lib/listings';
import { isDirectPurchaseListing } from '../../../lib/orders';
import { isValidUuid } from '../../../lib/validation';

type Props = {
  searchParams: Promise<{ listing?: string | string[] }>;
};

function OrderNotice({ title, message, backHref = '/' }: { title: string; message: string; backHref?: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7">
      <h1 className="text-xl font-bold text-[var(--foreground)]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
      <Link href={backHref} className="mt-5 inline-flex rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white">
        Go back
      </Link>
    </section>
  );
}

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const listingId = Array.isArray(params.listing) ? params.listing[0] : params.listing;

  if (!listingId || !isValidUuid(listingId)) {
    return (
      <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-10">
          <OrderNotice title="Choose a listing first" message="Open an eligible product listing to start an order request." />
        </main>
        <BottomNav />
      </div>
    );
  }

  const { listing, error } = await getListingById(listingId);
  const backHref = listing ? `/listing/${listing.id}` : '/';

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-10">
          <OrderNotice title="Listing unavailable" message="This listing could not be loaded. It may have been removed or is no longer available." />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!isDirectPurchaseListing(listing)) {
    return (
      <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-10">
          <OrderNotice
            title="This listing cannot be ordered online"
            message="Online order requests are available for active, priced physical products. For services or listings without a price, contact the seller from the listing page."
            backHref={backHref}
          />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <Link href={backHref} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--brand)]">
          Back to listing
        </Link>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Order request</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Review your order</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Confirm the item and how you would like to receive it. Submitting creates a request; it does not take payment.
          </p>
        </div>

        <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{listing.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{listing.category} · {listing.condition} · {listing.location || listing.campus || 'Campus listing'}</p>
              <p className="mt-3 text-sm text-[var(--muted)]">Seller: {listing.sellerName || 'CampusTrader seller'}</p>
            </div>
            <p className="shrink-0 text-xl font-bold text-[var(--brand)]">
              KSh {Number(listing.price).toLocaleString('en-KE')}
            </p>
          </div>
        </section>

        <OrderCheckoutForm
          listingId={listing.id}
          sellerId={listing.seller_id}
          listingPrice={Number(listing.price)}
          listingCampus={listing.campus || 'MUST'}
        />
      </main>
      <BottomNav />
    </div>
  );
}
