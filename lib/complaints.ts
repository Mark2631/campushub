import { supabase } from './supabase';
import { GENERIC_ERROR, cleanMultilineText, cleanText, isAllowedValue, isValidUuid } from './validation';

export interface ComplaintRecord {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export async function createComplaint(data: {
  userId: string | null;
  email: string;
  subject: string;
  message: string;
}) {
  const subject = cleanText(data.subject, 120);
  const message = cleanMultilineText(data.message, 1200);

  if (!subject || !message) {
    return { complaint: null, error: 'Subject and message are required.' };
  }

  const complaintToInsert = {
    user_id: data.userId && isValidUuid(data.userId) ? data.userId : null,
    email: cleanText(data.email, 180),
    subject,
    message,
    status: 'open',
  };

  const { data: complaint, error } = await supabase
    .from('complaints')
    .insert(complaintToInsert)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating complaint:', error, { complaintToInsert });
    return { complaint: null, error: GENERIC_ERROR };
  }

  return { complaint: complaint as ComplaintRecord, error: null };
}

export async function getComplaints() {
  const { data, error } = await supabase
    .from('complaints')
    .select('id, user_id, email, subject, message, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching complaints:', error);
    return { complaints: [], error: GENERIC_ERROR };
  }

  return { complaints: (data || []) as ComplaintRecord[], error: null };
}

export async function updateComplaintStatus(complaintId: string, status: 'open' | 'reviewed' | 'resolved') {
  if (!isValidUuid(complaintId) || !isAllowedValue(status, ['open', 'reviewed', 'resolved'] as const)) {
    return { error: GENERIC_ERROR };
  }

  const { error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', complaintId);

  if (error) {
    console.error('Error updating complaint status:', error);
  }

  return { error: error ? GENERIC_ERROR : null };
}
