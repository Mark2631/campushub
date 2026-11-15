'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import { normalizeKenyanPhone } from '../lib/phoneValidation';
import { supabase } from '../lib/supabase';

export default function WhatsAppButton({
  listingId,
  listingTitle,
  label = 'Continue on WhatsApp',
}: {
  listingId: string;
  listingTitle: string;
  label?: string;
}) {
  const { showToast } = useUser();
  const [busy, setBusy] = useState(false);

  const openWhatsApp = async () => {
    if (busy) return;
    setBusy(true);

    try {
      // The customer enquiry always goes to the configured CampusTrader
      // management contact. It must never fall back to a seller's private number.
      const { data, error } = await supabase.rpc('get_campustrader_whatsapp');
      if (error) {
        console.error('CampusTrader WhatsApp lookup failed:', error);
        showToast({ type: 'error', message: 'CampusTrader WhatsApp is unavailable right now. Please use the help form.' });
        return;
      }

      const number = normalizeKenyanPhone(typeof data === 'string' ? data : '');
      if (!number) {
        showToast({ type: 'info', message: 'CampusTrader has not configured its WhatsApp contact yet. Please use the help form.' });
        return;
      }

      const itemName = listingTitle.trim() || 'a product on CampusTrader';
      const message = [
        'Hello CampusTrader, I would like to enquire about: ' + itemName + '.',
        'Listing reference: ' + listingId,
        'Is this item available, and what are the next steps?',
        'Listing: ' + window.location.href,
      ].join('\n');
      const url = 'https://wa.me/' + number.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(message);
      window.location.assign(url);
    } catch (error) {
      console.error('Could not open CampusTrader WhatsApp:', error);
      showToast({ type: 'error', message: 'Could not open WhatsApp. Please try again or use the help form.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={openWhatsApp}
      disabled={busy}
      className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    >
      {busy ? 'Opening WhatsApp…' : label}
    </button>
  );
}
