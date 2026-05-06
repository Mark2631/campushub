import { supabase } from './supabase';

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
  const complaintToInsert = {
    user_id: data.userId,
    email: data.email,
    subject: data.subject,
    message: data.message,
    status: 'open',
  };

  const { data: complaint, error } = await supabase
    .from('complaints')
    .insert(complaintToInsert)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating complaint:', error, { complaintToInsert });
    return { complaint: null, error: error.message };
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
    return { complaints: [], error: error.message };
  }

  return { complaints: (data || []) as ComplaintRecord[], error: null };
}

export async function updateComplaintStatus(complaintId: string, status: 'open' | 'reviewed' | 'resolved') {
  const { error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', complaintId);

  if (error) {
    console.error('Error updating complaint status:', error);
  }

  return { error: error?.message || null };
}
