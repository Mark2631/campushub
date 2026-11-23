import { supabase } from './supabase';
import { cleanMultilineText, isValidUuid } from './validation';

export type SellerReview = {
  id: string;
  reviewer_id?: string;
  seller_id?: string;
  listing_id?: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

type ReviewResult = { reviews: SellerReview[]; count: number; error: Error | null };

function toError(value: unknown) {
  return value instanceof Error ? value : new Error('Reviews could not be loaded.');
}

export async function getReviewsWrittenByBuyer(reviewerId: string): Promise<ReviewResult> {
  if (!isValidUuid(reviewerId)) return { reviews: [], count: 0, error: new Error('Invalid reviewer.') };

  const { data, error, count } = await supabase
    .from('reviews')
    .select('id, seller_id, listing_id, rating, comment, created_at', { count: 'exact' })
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return { reviews: [], count: 0, error: toError(error) };
  return { reviews: (data || []) as SellerReview[], count: count || 0, error: null };
}

export async function getReviewsReceivedBySeller(sellerId: string): Promise<ReviewResult> {
  if (!isValidUuid(sellerId)) return { reviews: [], count: 0, error: new Error('Invalid seller.') };

  const { data, error, count } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at', { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { reviews: [], count: 0, error: toError(error) };
  return { reviews: (data || []) as SellerReview[], count: count || 0, error: null };
}

export async function createVerifiedPurchaseReview(input: {
  reviewerId: string;
  sellerId: string;
  listingId: string;
  rating: number;
  comment: string;
}) {
  if (
    !isValidUuid(input.reviewerId)
    || !isValidUuid(input.sellerId)
    || !isValidUuid(input.listingId)
    || input.reviewerId === input.sellerId
    || !Number.isInteger(input.rating)
    || input.rating < 1
    || input.rating > 5
  ) {
    return { review: null, error: 'Choose a rating from 1 to 5.' };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== input.reviewerId) {
    return { review: null, error: 'Sign in again to submit this review.' };
  }

  const comment = cleanMultilineText(input.comment, 600);
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      reviewer_id: input.reviewerId,
      seller_id: input.sellerId,
      listing_id: input.listingId,
      rating: input.rating,
      comment: comment || null,
    })
    .select('id, reviewer_id, seller_id, listing_id, rating, comment, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return { review: null, error: 'You have already reviewed this seller for this item.' };
    if (error.code === '42501') return { review: null, error: 'Reviews unlock only after a completed order and confirmed receipt.' };
    console.error('Verified purchase review failed:', error);
    return { review: null, error: 'Your review could not be saved. Refresh the order and try again.' };
  }

  return { review: data as SellerReview, error: null };
}

export type PublicSellerRating = {
  averageRating: number;
  reviewCount: number;
};

/**
 * Public rating endpoint returns aggregate values only. Until its reviewed SQL
 * migration is applied, an unavailable RPC simply hides the rating badge.
 */
export async function getPublicSellerRating(sellerId: string, listingId: string): Promise<PublicSellerRating | null> {
  if (!isValidUuid(sellerId) || !isValidUuid(listingId)) return null;

  const { data, error } = await supabase.rpc('get_public_seller_rating', {
    p_seller_id: sellerId,
    p_listing_id: listingId,
  });

  if (error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  const record = row as { average_rating?: unknown; review_count?: unknown };
  const averageRating = Number(record.average_rating);
  const reviewCount = Number(record.review_count);

  if (!Number.isFinite(averageRating) || !Number.isInteger(reviewCount) || reviewCount < 1) return null;
  if (averageRating < 1 || averageRating > 5) return null;

  return { averageRating, reviewCount };
}
