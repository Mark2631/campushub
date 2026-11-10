import { supabase } from './supabase';
import { cleanText, isValidUuid } from './validation';

export type SellerReview = {
  id: string;
  seller_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type SellerRatingSummary = {
  averageRating: number;
  reviewCount: number;
  reviews: SellerReview[];
};

export type SubmittedReview = {
  seller_id: string;
  listing_id: string | null;
  rating: number;
};

export async function getSellerRatingSummary(sellerId: string): Promise<SellerRatingSummary> {
  const empty: SellerRatingSummary = { averageRating: 0, reviewCount: 0, reviews: [] };
  if (!isValidUuid(sellerId)) return empty;

  const [summaryResponse, reviewsResponse] = await Promise.all([
    supabase
      .from('marketplace_seller_rating_summary')
      .select('average_rating, review_count')
      .eq('seller_id', sellerId)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('id, seller_id, listing_id, rating, comment, created_at')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (summaryResponse.error) console.error('Seller rating summary failed:', summaryResponse.error);
  if (reviewsResponse.error) console.error('Seller reviews failed:', reviewsResponse.error);

  return {
    averageRating: Number(summaryResponse.data?.average_rating || 0),
    reviewCount: Number(summaryResponse.data?.review_count || 0),
    reviews: (reviewsResponse.data || []) as SellerReview[],
  };
}

export async function getReviewsByReviewer(reviewerId: string): Promise<SubmittedReview[]> {
  if (!isValidUuid(reviewerId)) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('seller_id, listing_id, rating')
    .eq('reviewer_id', reviewerId)
    .limit(250);
  if (error) {
    console.error('Submitted reviews lookup failed:', error);
    return [];
  }
  return (data || []) as SubmittedReview[];
}

export async function submitOrderReview(args: {
  reviewerId: string;
  sellerId: string;
  listingId: string;
  rating: number;
  comment?: string;
}) {
  if (
    !isValidUuid(args.reviewerId)
    || !isValidUuid(args.sellerId)
    || !isValidUuid(args.listingId)
    || args.reviewerId === args.sellerId
    || !Number.isInteger(args.rating)
    || args.rating < 1
    || args.rating > 5
  ) {
    return { error: 'Choose a rating from one to five stars.' };
  }

  const comment = cleanText(args.comment || '', 500) || null;
  const { error } = await supabase
    .from('reviews')
    .insert({
      reviewer_id: args.reviewerId,
      seller_id: args.sellerId,
      listing_id: args.listingId,
      rating: args.rating,
      comment,
    });

  if (error) {
    console.error('Order review submit failed:', error);
    if (error.code === '23505') return { error: 'You have already rated this seller for this listing.' };
    if (error.code === '42501') return { error: 'Only a completed, receipt-confirmed order can be rated.' };
    return { error: 'Your rating could not be submitted. Refresh and try again.' };
  }

  return { error: null };
}
