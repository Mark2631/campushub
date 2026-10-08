'use client';

import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import useUser from '../hooks/useUser';
import {
  getListingInventory,
  getTransactionPayload,
  getTransactionResultError,
  setListingInventory,
} from '../lib/orders';

type Props = {
  listingId: string;
  sellerId: string;
  listingStatus: string;
};

type InventorySnapshot = {
  total_quantity: number;
  reserved_quantity: number;
  sold_quantity: number;
};

export default function ListingInventoryManager({ listingId, sellerId, listingStatus }: Props) {
  const { user, loading } = useUser();
  const canManageInventory = Boolean(user && user.id === sellerId && listingStatus.toLowerCase() === 'active');
  const [quantity, setQuantity] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { data: currentInventory, error: inventoryError, isLoading: inventoryLoading, mutate: mutateInventory } = useSWR<InventorySnapshot | null>(
    canManageInventory ? ['listing-inventory', listingId] : null,
    async () => {
      const result = await getListingInventory(listingId);
      if (result.error) throw result.error;
      const payload = getTransactionPayload(result.data);
      const total = Number(payload.total_quantity);
      if (!Number.isFinite(total)) return null;
      return {
        total_quantity: total,
        reserved_quantity: Number(payload.reserved_quantity) || 0,
        sold_quantity: Number(payload.sold_quantity) || 0,
      };
    },
    { revalidateOnFocus: true },
  );
  const displayedInventory = snapshot || currentInventory;

  if (loading || !user || user.id !== sellerId || listingStatus.toLowerCase() !== 'active') return null;

  async function submitInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const totalQuantity = Number(quantity);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 0) {
      setFeedback({ type: 'error', text: 'Enter a whole-number stock count of zero or more.' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const result = await setListingInventory(listingId, totalQuantity);
      const actionError = getTransactionResultError(result.error, result.data, 'general');
      if (actionError) {
        setFeedback({ type: 'error', text: actionError });
        return;
      }

      const payload = getTransactionPayload(result.data);
      const total = Number(payload.total_quantity);
      if (!Number.isFinite(total)) {
        setFeedback({ type: 'error', text: 'The backend did not return the saved inventory. Refresh the listing before retrying.' });
        return;
      }

      setSnapshot({
        total_quantity: total,
        reserved_quantity: Number(payload.reserved_quantity) || 0,
        sold_quantity: Number(payload.sold_quantity) || 0,
      });
      setQuantity(String(total));
      await mutateInventory();
      setFeedback({ type: 'success', text: total === 0 ? 'Stock saved as unavailable. Buyers cannot place a new order.' : 'Stock saved. Checkout availability is still checked by the backend.' });
    } catch {
      setFeedback({ type: 'error', text: 'Inventory could not be updated. No checkout stock was changed; retry after checking the listing.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby={`inventory-heading-${listingId}`}>
      <h2 id={`inventory-heading-${listingId}`} className="font-semibold">Protected-order stock</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-400">
        Enter the total real quantity you have for this listing. The backend keeps reserved and sold units protected; zero means unavailable.
      </p>
      {inventoryLoading ? <p role="status" className="mt-3 text-xs text-slate-500 dark:text-zinc-500">Loading current stock…</p> : null}
      {inventoryError ? <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-200">Current stock summary is unavailable. The backend will still protect reserved and sold units when you save.</p> : null}
      {displayedInventory ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-zinc-950">
          <div><dt className="text-slate-500 dark:text-zinc-500">Total</dt><dd className="mt-1 font-semibold">{displayedInventory.total_quantity}</dd></div>
          <div><dt className="text-slate-500 dark:text-zinc-500">Reserved</dt><dd className="mt-1 font-semibold">{displayedInventory.reserved_quantity}</dd></div>
          <div><dt className="text-slate-500 dark:text-zinc-500">Sold</dt><dd className="mt-1 font-semibold">{displayedInventory.sold_quantity}</dd></div>
        </dl>
      ) : null}
      <form onSubmit={submitInventory} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1 text-sm font-medium" htmlFor={`inventory-quantity-${listingId}`}>
          Total stock
          <input
            id={`inventory-quantity-${listingId}`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            value={quantity ?? (currentInventory ? String(currentInventory.total_quantity) : '')}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Enter actual quantity"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-zinc-700"
          />
        </label>
        <button type="submit" disabled={busy} className="self-end rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
          {busy ? 'Saving…' : 'Save stock'}
        </button>
      </form>
      {feedback ? <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl border p-3 text-sm leading-5 ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100' : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100'}`}>{feedback.text}</p> : null}
    </section>
  );
}
