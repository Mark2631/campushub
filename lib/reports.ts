import { supabase } from './supabase';

export const reportReasons = [
  'Scam or fraud',
  'Fake listing',
  'Harassment',
  'Unsafe meetup request',
  'Wrong category',
  'Other',
];

export async function createReport(data: {
  reporterId: string;
  targetType: 'listing' | 'message' | 'user' | 'business';
  targetId: string;
  reason: string;
  details: string;
}) {
  const reportToInsert = {
    reporter_id: data.reporterId,
    target_type: data.targetType,
    target_id: data.targetId,
    reason: data.reason,
    details: data.details,
    status: 'pending',
  };

  const { data: report, error } = await supabase
    .from('reports')
    .insert(reportToInsert)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating report:', error, { reportToInsert });
    return { report: null, error: error.message };
  }

  return { report, error: null };
}
