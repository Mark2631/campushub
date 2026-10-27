'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import { normalizeKenyanPhone } from '../lib/phoneValidation';
import { supabase } from '../lib/supabase';

export default function WhatsAppButton({ userId, label = 'Continue on WhatsApp', phoneNumber }: {
  userId: string;
  label?: string;
  phoneNumber?: string | null;
}) {
  const { showToast } = useUser();
  const [busy, setBusy] = useState(false);

  const openWhatsApp = async () => {
    if (busy) return;
    const supplied = normalizeKenyanPhone(phoneNumber || '');
    if (supplied) {
      window.location.assign(`https://wa.me/${supplied.replace(/[^0-9]/g, '')}`);
      return;
    }

    setBusy(true);
    try {
      // Contact is available through the public view only for active sellers.
      const { data, error } = await supabase.from('marketplace_profiles')
        .select('phone_number').eq('id', userId).maybeSingle();
      if (error) {
        console.error('Seller WhatsApp lookup failed:', error);
        showToast({ type: 'error', message: 'WhatsApp contact is unavailable right now. You can message the seller here.' });
        return;
      }
      const number = normalizeKenyanPhone(data?.phone_number || '');
      if (!number) {
        showToast({ type: 'info', message: 'This seller has not added a WhatsApp number. Use in-app messages.' });
        return;
      }
      // Same-tab navigation works in mobile browsers after awaiting a request.
      window.location.assign(`https://wa.me/${number.replace(/[^0-9]/g, '')}`);
    } catch (error) {
      console.error('Seller contact request failed:', error);
      showToast({ type: 'error', message: 'Could not open WhatsApp. Please try again or use Messages.' });
    } finally {
      setBusy(false);
    }
  };

  return <button type="button" onClick={openWhatsApp} disabled={busy} className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{busy ? 'Opening WhatsApp...' : label}</button>;
}
