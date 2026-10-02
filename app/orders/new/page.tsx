import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, MapPin, ShieldCheck, Truck } from 'lucide-react';
import Header from '../../../components/Header';
import BottomNav from '../../../components/BottomNav';
import { getListingById } from '../../../lib/listings';
import { isValidUuid } from '../../../lib/validation';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ listing?: string }> };

export default async function NewOrderPage({ searchParams }: Props) {
  const { listing: listingId } = await searchParams;
  const result = listingId && isValidUuid(listingId) ? await getListingById(listingId) : { listing: null, error: null };
  const listing = result.listing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24 text-gray-900 dark:from-black dark:to-zinc-950 dark:text-white">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
        <Link href={listing ? `/listing/${listing.id}` : '/'} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to listing
        </Link>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Protected order</p>
          <h1 className="mt-2 text-3xl font-bold">Review your order</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">Your payment will only be marked secured after a verified M-PESA callback.</p>
        </div>

        {!listing ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            This listing is unavailable. Return to the marketplace and choose an active listing.
          </section>
        ) : (
          <div className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">Item</p>
                  <h2 className="mt-2 text-xl font-bold">{listing.title}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{listing.sellerName || 'CampusTrader seller'}</p>
                </div>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-300">KSh {(listing.price ?? 0).toLocaleString()}</p>
              </div>
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                <MapPin className="h-4 w-4 text-blue-500" aria-hidden="true" /> {listing.location || 'Campus location'}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold">How would you like to receive it?</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/30">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"><Check className="h-3 w-3" aria-hidden="true" /></span>
                  <div className="flex-1"><p className="font-semibold">Pick up myself</p><p className="text-xs text-slate-500 dark:text-zinc-400">Free</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 opacity-80 dark:border-zinc-700">
                  <Truck className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  <div className="flex-1"><p className="font-semibold">D-Delivery</p><p className="text-xs text-slate-500 dark:text-zinc-400">Fee calculated by campus delivery rules</p></div>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">Payment merchant</p><h2 className="mt-2 font-bold">CampusTrader protected payments</h2><p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Till 6362615 · Newton Mwangi</p></div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">1% platform fee</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-zinc-500">The final fee and total will be calculated and confirmed by the backend before any payment request. No payment is initiated in this preview.</p>
            </section>

            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
              <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" /><div><p className="font-semibold text-blue-950 dark:text-blue-100">Transaction protection</p><p className="mt-1 text-sm leading-6 text-blue-800 dark:text-blue-200/80">CampusTrader holds the order state until handover and receipt are confirmed. Seller release is controlled by the transaction state.</p></div></div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-400">Item</span><span>KSh {(listing.price ?? 0).toLocaleString()}</span></div><div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-400">CampusTrader fee</span><span className="text-slate-400">Calculated securely at checkout</span></div><div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold dark:border-zinc-800"><span>Total</span><span>Calculated securely at checkout</span></div></div>
              <button disabled className="mt-5 w-full rounded-2xl bg-slate-300 px-5 py-4 text-sm font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">Payment setup required</button>
              <p className="mt-3 text-center text-xs leading-5 text-slate-500 dark:text-zinc-500">Payment initiation is intentionally unavailable until the verified backend order and Daraja callback endpoints are connected. No payment was created.</p>
            </section>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
