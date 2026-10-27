'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

type RequestStatus = 'pending' | 'contacted' | 'rider_assigned' | 'completed' | 'cancelled';
type DeliveryServiceRequest = {
  id: string;
  requester_role: 'buyer' | 'seller';
  business_id: string;
  listing_id: string;
  item_description: string;
  pickup_location: string;
  dropoff_location: string;
  contact_name: string;
  contact_phone: string;
  notes: string | null;
  status: RequestStatus;
  created_at: string;
};
type Draft = { status: RequestStatus; admin_notes: string };

const statuses: Array<{ value: RequestStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'rider_assigned', label: 'Rider assigned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function displayDate(value: string) {
  return new Date(value).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ManualDeliveryRequests() {
  const [requests, setRequests] = useState<DeliveryServiceRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('delivery_service_requests')
      .select('id, requester_role, business_id, listing_id, item_description, pickup_location, dropoff_location, contact_name, contact_phone, notes, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Delivery service request queue failed to load:', error);
      setRequests([]);
      setMessage({ type: 'error', text: 'The delivery request queue could not load. Check that the database migration has been applied.' });
    } else {
      const next = (data || []) as DeliveryServiceRequest[];
      let noteByRequest: Record<string, string> = {};
      let noteLoadMessage: string | null = null;
      if (next.length > 0) {
        const { data: privateNotes, error: privateNotesError } = await supabase
          .from('delivery_service_request_admin_notes')
          .select('request_id, note')
          .in('request_id', next.map((request) => request.id));
        if (privateNotesError) {
          console.error('Private delivery coordination notes failed to load:', privateNotesError);
          noteLoadMessage = 'Requests loaded, but private coordination notes could not be loaded.';
        } else {
          noteByRequest = Object.fromEntries((privateNotes || []).map((row: { request_id: string; note: string }) => [row.request_id, row.note || '']));
        }
      }
      setRequests(next);
      setDrafts(Object.fromEntries(next.map((request) => [
        request.id,
        { status: request.status, admin_notes: noteByRequest[request.id] || '' },
      ])));
      if (noteLoadMessage) setMessage({ type: 'error', text: noteLoadMessage });
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || { status: 'pending', admin_notes: '' }), ...patch },
    }));
  };

  const saveRequest = async (requestId: string) => {
    const draft = drafts[requestId];
    if (!draft || busyId) return;
    setBusyId(requestId);
    setMessage(null);
    const { data, error } = await supabase
      .from('delivery_service_requests')
      .update({
        status: draft.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('id, status')
      .single();

    if (error || !data) {
      setBusyId(null);
      console.error('Delivery request update failed:', error);
      setMessage({ type: 'error', text: 'Could not save the status. Refresh the queue and try again.' });
      return;
    }

    const { error: noteError } = await supabase
      .from('delivery_service_request_admin_notes')
      .upsert({
        request_id: requestId,
        note: draft.admin_notes.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'request_id' });

    setBusyId(null);
    setRequests((current) => current.map((request) => request.id === requestId
      ? { ...request, status: data.status as RequestStatus }
      : request));
    if (noteError) {
      console.error('Private delivery note update failed:', noteError);
      setMessage({ type: 'error', text: 'Status saved, but the private coordination note could not be saved.' });
      return;
    }
    setMessage({ type: 'success', text: 'Delivery request and private coordination note updated.' });
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Service delivery requests</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Requests from buyers or sellers for manual delivery coordination. Contact the person, check whether a rider is available, then record the agreed status here.</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); setMessage(null); void loadRequests(); }} disabled={loading} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-60">
          {loading ? 'Refreshing…' : 'Refresh requests'}
        </button>
      </header>
      {message ? <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}>{message.text}</p> : null}
      {loading ? <p className="py-8 text-center text-sm text-zinc-400">Loading delivery requests…</p> : null}
      {!loading && requests.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400">No delivery requests yet.</div> : null}
      <div className="space-y-4">
        {requests.map((request) => {
          const draft = drafts[request.id] || { status: request.status, admin_notes: request.admin_notes || '' };
          return (
            <article key={request.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-white">{request.item_description}</h3>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">{request.requester_role === 'seller' ? 'Seller request' : 'Buyer request'}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Submitted {displayDate(request.created_at)} · Request {request.id.slice(0, 8)}</p>
                </div>
                <Link href={`/listing/${request.listing_id}`} className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-blue-500">View listing</Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-black/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contact</p>
                  <p className="mt-1 font-semibold text-white">{request.contact_name}</p>
                  <a href={`tel:${request.contact_phone}`} className="mt-1 block text-sm text-zinc-200 underline underline-offset-2">{request.contact_phone}</a>
                  <a href={`https://wa.me/${request.contact_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-emerald-300 underline underline-offset-2">Message on WhatsApp</a>
                </div>
                <div className="rounded-xl bg-black/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Route</p>
                  <p className="mt-1 text-sm text-zinc-200"><span className="font-semibold">Pickup:</span> {request.pickup_location}</p>
                  <p className="mt-1 text-sm text-zinc-200"><span className="font-semibold">Drop-off:</span> {request.dropoff_location}</p>
                </div>
              </div>
              {request.notes ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">Customer notes: {request.notes}</p> : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-zinc-300">Status</span>
                  <select value={draft.status} onChange={(event) => updateDraft(request.id, { status: event.target.value as RequestStatus })} className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-sm text-white">
                    {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-zinc-300">Private coordination notes</span>
                  <textarea value={draft.admin_notes} onChange={(event) => updateDraft(request.id, { admin_notes: event.target.value })} rows={2} maxLength={1200} placeholder="Rider contacted, quoted fee, agreed time…" className="w-full resize-y rounded-xl border border-zinc-700 bg-black px-3 py-3 text-sm text-white" />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => void saveRequest(request.id)} disabled={busyId !== null} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {busyId === request.id ? 'Saving…' : 'Save update'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
