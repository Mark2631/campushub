'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import { normalizeKenyanPhone } from '../lib/phoneValidation';
import { supabase } from '../lib/supabase';

export default function WhatsAppButton({
  listingId,
  listingTitle,
  label = 'Contact CampusTrader on WhatsApp',
}: {
  listingId?: string;
  listingTitle?: string;
  label?: string;
}) {
  const { showToast } = useUser();
  const [busy, setBusy] = useState(false);

  const openWhatsApp = async () => {
    if (busy) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('get_campustrader_whatsapp');
      if (error) {
        console.error('CampusTrader WhatsApp lookup failed:', error);
        showToast({ type: 'error', message: 'CampusTrader WhatsApp is unavailable right now. Please use the Help page.' });
        return;
      }

      const number = normalizeKenyanPhone(typeof data === 'string' ? data : '');
      if (!number) {
        showToast({ type: 'info', message: 'CampusTrader has not configured its WhatsApp number yet. Please use the Help page.' });
        return;
      }

      const itemReference = listingId ? ` (listing ${listingId.slice(0, 8)})` : '';
      const itemMessage = listingTitle?.trim()
        ? `I am interested in "${listingTitle.trim()}"${itemReference}.`
        : 'I need help with an item on CampusTrader.';
      const message = `Hello CampusTrader, ${itemMessage} Please help me confirm availability, the final price and the next step for collection or delivery.`;

      window.location.assign(`https://wa.me/${number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`);
    } catch (error) {
      console.error('CampusTrader contact request failed:', error);
      showToast({ type: 'error', message: 'Could not open CampusTrader WhatsApp. Please try again or use the Help page.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={openWhatsApp}
      disabled={busy}
      className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    >
      {busy ? 'Opening CampusTrader WhatsApp…' : label}
    </button>
  );
}
