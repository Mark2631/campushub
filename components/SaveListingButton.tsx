'use client';

import { useEffect, useState } from 'react';
import useUser from '../hooks/useUser';
import { supabase } from '../lib/supabase';
import AuthPromptModal from './AuthPromptModal';

export default function SaveListingButton({ listingId }: { listingId: string }) {
  const { user, loading } = useUser();
  const [message, setMessage] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [savedRecord, setSavedRecord] = useState<{ userId: string; listingId: string; saved: boolean } | null>(null);
  const [checkedRecord, setCheckedRecord] = useState<{ userId: string; listingId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const isSaved = Boolean(user?.id && savedRecord?.userId === user.id && savedRecord.listingId === listingId && savedRecord.saved);
  const checkingSaved = Boolean(user?.id && (checkedRecord?.userId !== user.id || checkedRecord.listingId !== listingId));

  useEffect(() => {
    if (!user?.id || !listingId) return;

    let mounted = true;
    const loadSavedState = async () => {
      try {
        const { data, error } = await supabase
          .from('saved_listings')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', listingId)
          .maybeSingle();

        if (!mounted) return;
        if (error) {
          console.error('Saved listing lookup failed:', error);
          setMessage('Saved items could not be loaded. Try refreshing.');
        } else {
          setSavedRecord({ userId: user.id, listingId, saved: Boolean(data) });
        }
      } catch (error) {
        if (!mounted) return;
        console.error('Saved listing lookup failed:', error);
        setMessage('Saved items could not be loaded. Try refreshing.');
      } finally {
        if (mounted) setCheckedRecord({ userId: user.id, listingId });
      }
    };

    void loadSavedState();
    return () => {
      mounted = false;
    };
  }, [user?.id, listingId]);

  const handleSave = async () => {
    if (!user) {
      setNeedsSignIn(true);
      setMessage(null);
      return;
    }
    if (saving || checkingSaved) return;

    setNeedsSignIn(false);
    setSaving(true);
    setMessage(null);
    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_listings')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId);

        if (error) throw error;
        setSavedRecord({ userId: user.id, listingId, saved: false });
        setMessage('Removed from saved listings.');
      } else {
        const { error } = await supabase
          .from('saved_listings')
          .insert({ user_id: user.id, listing_id: listingId });

        // A double tap or a second device may have saved it first. Treat the
        // unique-key response as saved; do not report a false failure.
        if (error && error.code !== '23505') throw error;
        setSavedRecord({ userId: user.id, listingId, saved: true });
        setMessage('Saved to your account.');
      }
    } catch (error) {
      console.error('Saved listing update failed:', error);
      setMessage('Could not save this listing. Refresh and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading || checkingSaved || saving}
        onClick={handleSave}
        aria-pressed={isSaved}
        className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        {checkingSaved ? 'Checking saved items…' : saving ? 'Saving…' : isSaved ? 'Saved · Remove' : 'Save listing'}
      </button>
      {needsSignIn ? (
        <AuthPromptModal open={needsSignIn} next={`/listing/${listingId}`} onClose={() => setNeedsSignIn(false)} />
      ) : null}
      {message ? <p role="status" className="text-sm text-gray-600 dark:text-zinc-400">{message}</p> : null}
    </div>
  );
}
