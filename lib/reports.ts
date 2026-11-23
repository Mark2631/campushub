import { supabase } from './supabase';
import { GENERIC_ERROR, cleanMultilineText, isAllowedValue, isValidUuid } from './validation';

export const reportReasons = [
  'Scam or fraud',
  'Fake listing',
  'Suspected counterfeit or fake product',
  'Product condition or photos do not match',
  'Price changed after enquiry',
  'Product is not available',
  'Seller is not responding',
  'Unsafe transaction or delivery',
  'Rental is no longer available',
  'Rent or deposit differs from listing',
  'Room photos or details are misleading',
  'Fake landlord or rental scam',
  'Unsafe viewing request',
  'Landlord is not responding',
  'Roommate post is no longer available',
  'Monthly share or bills differ from listing',
  'Room or house rules are misleading',
  'Unsafe or discriminatory contact',
  'Poster is not responding',
  'Service differs from listing',
  'Provider is not responding',
  'Unsafe or misleading service',
  'Harassment',
  'Unsafe meetup request',
  'Wrong category',
  'Other',
] as const;

export type ReportContext = 'product' | 'accommodation' | 'roommate' | 'service';

const reportReasonsByContext: Record<ReportContext, readonly string[]> = {
  product: [
    'Product condition or photos do not match',
    'Suspected counterfeit or fake product',
    'Price changed after enquiry',
    'Product is not available',
    'Seller is not responding',
    'Unsafe transaction or delivery',
    'Scam or fraud',
    'Other',
  ],
  accommodation: [
    'Rental is no longer available',
    'Rent or deposit differs from listing',
    'Room photos or details are misleading',
    'Fake landlord or rental scam',
    'Unsafe viewing request',
    'Landlord is not responding',
    'Scam or fraud',
    'Other',
  ],
  roommate: [
    'Roommate post is no longer available',
    'Monthly share or bills differ from listing',
    'Room or house rules are misleading',
    'Unsafe or discriminatory contact',
    'Poster is not responding',
    'Harassment',
    'Other',
  ],
  service: [
    'Service differs from listing',
    'Price changed after enquiry',
    'Provider is not responding',
    'Unsafe or misleading service',
    'Scam or fraud',
    'Other',
  ],
};

export function getReportReasons(targetType: 'listing' | 'message' | 'user' | 'business', context?: ReportContext) {
  if (targetType === 'listing' && context) return reportReasonsByContext[context];
  if (targetType === 'business') return ['Scam or fraud', 'Fake listing', 'Provider is not responding', 'Unsafe or misleading service', 'Other'];
  if (targetType === 'user' || targetType === 'message') return ['Harassment', 'Scam or fraud', 'Unsafe meetup request', 'Unsafe or discriminatory contact', 'Other'];
  return ['Scam or fraud', 'Fake listing', 'Wrong category', 'Unsafe meetup request', 'Other'];
}

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
