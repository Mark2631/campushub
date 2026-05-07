'use client';

import { useState } from 'react';
import useUser from '../hooks/useUser';
import { createReport, reportReasons } from '../lib/reports';

type Props = {
  targetType: 'listing' | 'message' | 'user' | 'business';
  targetId: string;
  label?: string;
};

export default function ReportButton({ targetType, targetId, label = 'Report' }: Props) {
  const { user, pushNotification } = useUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reportReasons[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setMessage('Please sign in to submit a report.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    const { error } = await createReport({
      reporterId: user.id,
      targetType,
      targetId,
      reason,
      details,
    });
    setSubmitting(false);

    if (error) {
      setMessage(error);
      return;
    }

    await pushNotification({
      type: 'report',
      title: 'Report submitted',
      body: `Your ${targetType} report has been sent for review.`,
    });
    setMessage('Report submitted for admin review.');
    setDetails('');
    window.setTimeout(() => setOpen(false), 900);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Report {targetType}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Reports are reviewed by admin.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-900">
                Close
              </button>
            </div>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Reason</span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              >
                {reportReasons.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block space-y-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Details</span>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={4}
                className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                placeholder="Add context for the admin team."
              />
            </label>

            {message ? <p className="mt-4 text-sm text-blue-600 dark:text-blue-300">{message}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-500"
            >
              {submitting ? 'Submitting...' : 'Submit report'}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
