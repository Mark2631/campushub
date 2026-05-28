import { supabase } from './supabase';
import { GENERIC_ERROR, cleanMultilineText, isAllowedValue, isValidUuid } from './validation';

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
  if (!isValidUuid(data.reporterId) || !isValidUuid(data.targetId) || !isAllowedValue(data.targetType, ['listing', 'message', 'user', 'business'] as const)) {
    return { report: null, error: GENERIC_ERROR };
  }

  const reason = reportReasons.includes(data.reason) ? data.reason : 'Other';
  const details = cleanMultilineText(data.details, 1000);

  const reportToInsert = {
    reporter_id: data.reporterId,
    target_type: data.targetType,
    target_id: data.targetId,
    reason,
    details,
    status: 'pending',
  };

  const { data: report, error } = await supabase
    .from('reports')
    .insert(reportToInsert)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating report:', error, { reportToInsert });
    return { report: null, error: GENERIC_ERROR };
  }

  return { report, error: null };
}
