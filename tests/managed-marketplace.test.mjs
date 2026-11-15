import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('homepage uses product departments, a business shelf and a clear request path', async () => {
  const home = await read('../app/page.tsx');
  const card = await read('../components/ListingCard.tsx');
  const bottomNav = await read('../components/BottomNav.tsx');
  assert.match(bottomNav, /label: 'Submit'/);
  assert.match(home, /Shop by category/);
  assert.match(home, /categoryShelves/);
  assert.match(home, /Campus businesses/);
  assert.match(home, /Promote a business/);
  assert.match(home, /\/sell\?mode=request/);
  assert.match(card, /listing\.category/);
  assert.match(card, /listing\.condition/);
  assert.match(card, /listing\.description/);
  assert.match(card, /listing\.negotiable \? 'Negotiable' : 'Fixed price'/);
  assert.match(card, /Price on enquiry/);
  assert.match(card, /Reviewed/);
});

test('new and edited seller listings remain private until management review', async () => {
  const listings = await read('../lib/listings.ts');
  const migration = await read('../supabase/migrations/20261115103000_managed_marketplace_and_conversations.sql');
  const insertStart = listings.indexOf('export async function insertListing(');
  const insertEnd = listings.indexOf('export async function getListingById(', insertStart);
  const insertFn = listings.slice(insertStart, insertEnd);
  assert.match(insertFn, /status: 'hidden'/);
  assert.match(insertFn, /moderation_status: 'pending_review'/);

  const updateStart = listings.indexOf('export async function updateListing(');
  const updateEnd = listings.indexOf('export async function uploadListingMedia(', updateStart);
  const updateFn = listings.slice(updateStart, updateEnd);
  assert.match(updateFn, /status: 'hidden' as const/);
  assert.match(updateFn, /moderation_status: 'pending_review'/);

  assert.match(migration, /CREATE TRIGGER listings_force_management_review/i);
  assert.match(migration, /CREATE POLICY ct_managed_submissions_insert_guard[\s\S]*?status = 'hidden'[\s\S]*?moderation_status = 'pending_review'/i);
  assert.match(migration, /CREATE POLICY ct_managed_submissions_update_guard/i);
  assert.match(migration, /UPDATE public\.listings[\s\S]*?moderation_status = 'pending_review'[\s\S]*?WHERE status = 'active'/i);
});

test('management sets the final price and can reject with a reason', async () => {
  const admin = await read('../lib/admin.ts');
  const page = await read('../app/admin/page.tsx');
  assert.match(admin, /export async function approveListingSubmission/);
  assert.match(admin, /price: finalPrice/);
  assert.match(admin, /status: 'active'/);
  assert.match(admin, /moderation_status: 'safe'/);
  assert.match(admin, /export async function rejectListingSubmission/);
  assert.match(admin, /moderation_status: 'rejected'/);
  assert.match(page, /Final public price \(KSh\)/);
  assert.match(page, /Approve & publish/);
  assert.match(page, /Reject submission/);
  assert.match(page, /Seller&apos;s suggested price/);
});

test('seller account is an ordinary member and review status is visible', async () => {
  const profile = await read('../app/profile/page.tsx');
  const card = await read('../components/ListingCard.tsx');
  const detail = await read('../app/listing/[id]/page.tsx');
  assert.match(profile, /CampusTrader member/);
  assert.match(profile, /Awaiting management review/);
  assert.match(profile, /Changes requested/);
  assert.match(profile, /listing\.status === 'active'/);
  assert.doesNotMatch(profile, /Verified seller/);
  assert.match(card, /CampusTrader member/);
  assert.match(detail, /Product details reviewed by CampusTrader management/);
  assert.match(detail, /Request a similar item/);
});

test('one direct conversation is reused per buyer-seller pair across products', async () => {
  const conversations = await read('../lib/conversations.ts');
  const messageButton = await read('../components/MessageSellerButton.tsx');
  const migration = await read('../supabase/migrations/20261115103000_managed_marketplace_and_conversations.sql');
  assert.match(conversations, /and\(buyer_id\.eq\.\$\{buyerId\},seller_id\.eq\.\$\{sellerId\}\),and\(buyer_id\.eq\.\$\{sellerId\},seller_id\.eq\.\$\{buyerId\}\)/);
  assert.match(conversations, /\.limit\(1\)[\s\S]*?\.maybeSingle\(\)/);
  assert.match(messageButton, /\?item=\$\{encodeURIComponent\(listingTitle\)\}&listing=\$\{encodeURIComponent\(listingId\)\}/);
  assert.match(migration, /UPDATE public\.messages AS message[\s\S]*?SET conversation_id = merge\.keep_id/i);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS conversations_listing_id_buyer_id_seller_id_key/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS conversations_participant_pair_unique_idx/i);
});

test('only management can publish to campus communities', async () => {
  const communities = await read('../lib/community.ts');
  const detail = await read('../app/community/[groupId]/page.tsx');
  const directory = await read('../app/community/page.tsx');
  const admin = await read('../app/admin/page.tsx');
  const migration = await read('../supabase/migrations/20261115103000_managed_marketplace_and_conversations.sql');
  assert.doesNotMatch(communities, /posting_mode: 'everyone'/);
  assert.match(communities, /if \(!isAdmin\)/);
  assert.match(detail, /user && isAdmin \?/);
  assert.match(detail, /if \(!isAdmin\)/);
  assert.doesNotMatch(directory, /createCommunityRequest|Request a community/);
  assert.match(admin, /Management-only posting/);
  assert.match(migration, /UPDATE public\.communities[\s\S]*?SET posting_mode = 'admin_only'/);
  assert.match(migration, /DROP POLICY IF EXISTS users_can_request_communities/);
});

test('messaging and product enquiry channels remain distinct', async () => {
  const chat = await read('../app/messages/[id]/page.tsx');
  const listing = await read('../app/listing/[id]/page.tsx');
  assert.doesNotMatch(chat, /WhatsAppButton/);
  assert.match(chat, /This is your ongoing chat/);
  assert.match(chat, /interestTitle/);
  assert.match(listing, /MessageSellerButton listingId=\{listing\.id\} listingTitle=\{listing\.title\}/);
  assert.match(listing, /WhatsAppButton listingId=\{listing\.id\} listingTitle=\{listing\.title\}/);
});
