'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import { getProfileById } from '../lib/profiles';

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
    if (phoneNumber) {
      window.open(`https://wa.me/${phoneNumber}`, '_blank', 'noopener,noreferrer');
      return;
    }

    setBusy(true);
    const { profile, error } = await getProfileById(userId);
    setBusy(false);

    if (error) {
      showToast({ type: 'error', message: error });
      return;
    }

    if (!profile?.phone_number) {
      showToast({ type: 'info', message: 'Seller has not added a WhatsApp number yet. Use in-app messages.' });
      return;
    }

    window.open(`https://wa.me/${profile.phone_number}`, '_blank', 'noopener,noreferrer');
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
