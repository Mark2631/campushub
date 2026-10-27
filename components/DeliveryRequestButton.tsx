'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import { getInstitutionIdForUser } from '../lib/institutions';
import { normalizeKenyanPhone } from '../lib/phoneValidation';
import { supabase } from '../lib/supabase';
import AuthPromptModal from './AuthPromptModal';

type Props = {
  listingId: string;
  listingTitle: string;
  businessId: string;
  sellerId: string;
  pickupLocation: string;
};

export default function DeliveryRequestButton({
  listingId,
  listingTitle,
  businessId,
  sellerId,
  pickupLocation,
}: Props) {
  const { user, loading, showToast } = useUser();
  const [open, setOpen] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [pickup, setPickup] = useState(pickupLocation);
  const [dropoff, setDropoff] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpen = () => {
    if (loading) return;
    if (!user) {
      setNeedsSignIn(true);
      return;
    }
    if (user.id === sellerId) {
      setContactName((current) => current || String(user.user_metadata?.full_name || user.user_metadata?.name || ''));
      setOpen((current) => !current);
      setStatus(null);
      setErrorMessage(null);
      return;
    }
    setContactName((current) => current || String(user.user_metadata?.full_name || user.user_metadata?.name || ''));
    setOpen((current) => !current);
    setStatus(null);
    setErrorMessage(null);
  };

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || busy) return;

    const cleanName = contactName.trim();
    const normalizedPhone = normalizeKenyanPhone(contactPhone);
    const cleanPickup = pickup.trim();
    const cleanDropoff = dropoff.trim();

    if (!cleanName) {
      setErrorMessage('Enter the contact person’s name.');
      return;
    }
    if (!normalizedPhone) {
      setErrorMessage('Enter a valid Kenyan mobile number, for example 0712345678.');
      return;
    }
    if (!cleanPickup || !cleanDropoff) {
      setErrorMessage('Enter both pickup and delivery locations.');
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setStatus(null);

    try {
      const institutionId = await getInstitutionIdForUser(user.id);
      if (!institutionId) {
        setErrorMessage('Your account is not linked to an active institution. Contact CampusTrader support.');
        return;
      }

      const { data, error } = await supabase
        .from('delivery_service_requests')
        .insert({
          requester_id: user.id,
          requester_role: user.id === sellerId ? 'seller' : 'buyer',
          business_id: businessId,
          listing_id: listingId,
          institution_id: institutionId,
          item_description: listingTitle,
          pickup_location: cleanPickup,
          dropoff_location: cleanDropoff,
          contact_name: cleanName,
          contact_phone: normalizedPhone,
          notes: notes.trim() || null,
          status: 'pending',
          admin_notes: null,
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        console.error('Manual delivery request failed:', error);
        setErrorMessage('The request could not be submitted. Refresh the page and try again.');
        return;
      }

      setStatus('Request received. CampusTrader will contact you to confirm rider availability, the fee and timing. No rider has been booked and no payment has been made.');
      setDropoff('');
      setNotes('');
      showToast({ type: 'success', message: 'Delivery request sent to CampusTrader.' });
    } catch (error) {
      console.error('Manual delivery request failed:', error);
      setErrorMessage('The request could not be submitted. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        Arrange delivery through CampusTrader
      </button>
      {needsSignIn ? (
        <AuthPromptModal open={needsSignIn} next={`/listing/${listingId}`} onClose={() => setNeedsSignIn(false)} />
      ) : null}
      {open ? (
        <form onSubmit={submitRequest} className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-950">
          <div>
            <h3 className="font-bold">Delivery request</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
              Share where the item should be collected and delivered. CampusTrader will check availability and contact you before any delivery is agreed.
            </p>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Contact person</span>
            <input value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={120} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Phone number</span>
            <input type="tel" inputMode="tel" autoComplete="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="0712345678" maxLength={20} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Pickup location</span>
            <input value={pickup} onChange={(event) => setPickup(event.target.value)} maxLength={240} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Delivery location and landmark</span>
            <input value={dropoff} onChange={(event) => setDropoff(event.target.value)} maxLength={240} required placeholder="Building, estate, gate or nearby landmark" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Extra instructions (optional)</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} placeholder="Item size, preferred time, or directions" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          {errorMessage ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p> : null}
          {status ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{status}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700">Close</button>
            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Sending request…' : 'Send request'}
            </button>
          </div>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">No M-Pesa payment or automatic rider booking is part of this request.</p>
        </form>
      ) : null}
    </div>
  );
}
