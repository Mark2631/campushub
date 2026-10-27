'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import { getProfileById } from '../lib/profiles';
import { normalizeKenyanPhone } from '../lib/phoneValidation';

export default function WhatsAppButton({
  userId,
  label = 'Continue on WhatsApp',
  phoneNumber,
}: {
  userId: string;
  label?: string;
  phoneNumber?: string | null;
}) {
  const { showToast } = useUser();
  const [busy, setBusy] = useState(false);

  const openWhatsApp = async () => {
    const suppliedNumber = normalizeKenyanPhone(phoneNumber || '');
    if (suppliedNumber) {
      window.location.assign(`https://wa.me/${suppliedNumber.replace(/[^0-9]/g, '')}`);
      return;
    }

    setBusy(true);
    const { profile, error } = await getProfileById(userId);
    setBusy(false);

    if (error) {
      showToast({ type: 'error', message: error });
      return;
    }

    const sellerNumber = normalizeKenyanPhone(profile?.phone_number || '');
    if (!sellerNumber) {
      showToast({ type: 'info', message: 'Seller has not added a WhatsApp number yet. Use in-app messages.' });
      return;
    }

    // Navigation after the network request must not rely on a popup,
    // which mobile browsers may block outside the original click event.
    window.location.assign(`https://wa.me/${sellerNumber.replace(/[^0-9]/g, '')}`);
  };

  return (
    <button
      type="button"
      onClick={openWhatsApp}
      disabled={busy}
      className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    >
      {busy ? 'Checking WhatsApp...' : label}
    </button>
  );
}
