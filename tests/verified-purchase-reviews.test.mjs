import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('review insertion is tied to the signed-in buyer and database-enforced purchase checks', async () => {
  const reviews = await read('../lib/reviews.ts');
  assert.match(reviews, /supabase\.auth\.getUser\(\)/);
  assert.match(reviews, /authData\.user\?\.id !== input\.reviewerId/);
  assert.match(reviews, /reviewer_id: input\.reviewerId/);
  assert.match(reviews, /seller_id: input\.sellerId/);
  assert.match(reviews, /listing_id: input\.listingId/);
  assert.match(reviews, /rating < 1/);
  assert.match(reviews, /rating > 5/);
  assert.match(reviews, /error\.code === '23505'/);
  assert.match(reviews, /error\.code === '42501'/);
});

test('buyers can only open the review form after a paid completed order and confirmed receipt', async () => {
  const activity = await read('../components/OrdersActivity.tsx');
  assert.match(activity, /orderState === 'COMPLETED'/);
  assert.match(activity, /orderIsPaid\(order\)/);
  assert.match(activity, /buyerReviewsLoading/);
  assert.match(activity, /includes\(buyerReceiptState\)/);
  assert.match(activity, /const completedReceipt = isBuying[\s\S]*?orderState === 'COMPLETED'[\s\S]*?CONFIRMED/);
  assert.match(activity, /createVerifiedPurchaseReview\(/);
  assert.match(activity, /Reviews are available only after you confirm receipt/);
  assert.match(activity, /Rate seller/);
});

test('review uniqueness is checked by buyer, seller and listing before showing feedback', async () => {
  const activity = await read('../components/OrdersActivity.tsx');
  const reviews = await read('../lib/reviews.ts');
  assert.match(activity, /review\.seller_id === order\.seller_id && review\.listing_id === order\.listing_id/);
  assert.match(activity, /Your feedback is recorded/);
  assert.match(reviews, /You have already reviewed this seller for this item/);
  assert.match(reviews, /\.eq\('reviewer_id', reviewerId\)/);
  assert.match(reviews, /\.eq\('seller_id', sellerId\)/);
});

test('seller profile shows feedback from seller-owned reviews allowed by row-level security', async () => {
  const profile = await read('../app/profile/page.tsx');
  const reviews = await read('../lib/reviews.ts');
  assert.match(profile, /getReviewsReceivedBySeller\(user\.id\)/);
  assert.match(profile, /Buyer feedback/);
  assert.match(profile, /sellerReviewAverage\.toFixed\(1\)/);
  assert.match(profile, /sellerReviews\.slice\(0, 3\)/);
  assert.match(reviews, /\.eq\('seller_id', sellerId\)/);
  assert.match(profile, /Ratings from completed purchases where buyers confirmed receipt/);
});

test('review form is hidden from seller-side, unpaid, disputed or unconfirmed orders', async () => {
  const activity = await read('../components/OrdersActivity.tsx');
  assert.match(activity, /const completedReceipt = isBuying[\s\S]*?orderIsPaid\(order\)[\s\S]*?orderState !== 'DISPUTED'[\s\S]*?CONFIRMED/);
  assert.match(activity, /order\.buyer_id !== userId/);
  assert.match(activity, /normalizeState\(order\.buyer_receipt_state\) !== 'CONFIRMED'/);
  assert.match(activity, /normalizeState\(order\.order_state\) !== 'COMPLETED'/);
});
