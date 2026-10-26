import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Supabase clients never silently fall back to production or fake credentials', async () => {
  const [browser, server, config] = await Promise.all([
    read('../lib/supabase.ts'),
    read('../utils/supabase/server.ts'),
    read('../next.config.ts'),
  ]);
  for (const source of [browser, server, config]) {
    assert.doesNotMatch(source, /https:\/\/hnhhednibexcfwfizawy\.supabase\.co/);
  }
  assert.match(browser, /if \(!supabaseUrl \|\| !supabaseAnonKey\)/);
  assert.match(server, /if \(!url \|\| !key\)/);
  assert.match(config, /if \(!supabaseUrl \|\| !supabasePublishableKey\)/);
});

test('listing edits do not attempt to change immutable institution identity', async () => {
  const source = await read('../lib/listings.ts');
  const start = source.indexOf('export async function updateListing(');
  const end = source.indexOf('export async function uploadListingMedia(', start);
  assert.ok(start >= 0 && end > start, 'updateListing function should exist');
  const fn = source.slice(start, end);
  const payloadStart = fn.indexOf('const payload = {');
  const payloadEnd = fn.indexOf('updated_at:', payloadStart);
  assert.ok(payloadStart >= 0 && payloadEnd > payloadStart, 'listing update payload should exist');
  const payload = fn.slice(payloadStart, payloadEnd);
  assert.doesNotMatch(payload, /^\s*(campus|institution_id)\s*:/m);
});

test('seller lifecycle updates verify owner and returned status', async () => {
  const source = await read('../lib/listings.ts');
  const start = source.indexOf('export async function updateListingLifecycleStatus(');
  const end = source.indexOf('export async function updateListing(', start);
  const fn = source.slice(start, end);
  assert.match(fn, /\.eq\('user_id', sellerId\)/);
  assert.match(fn, /\.eq\('seller_id', sellerId\)/);
  assert.match(fn, /data\.status !== status/);
});

test('request deletion does not report success when RLS affects zero rows', async () => {
  const source = await read('../lib/itemRequests.ts');
  const start = source.indexOf('export async function deleteItemRequest(');
  const fn = source.slice(start);
  assert.match(fn, /\.delete\(\)[\s\S]*?\.select\('id'\)/);
  assert.match(fn, /deletedRows\?\.some\(\(row\) => row\.id === requestId\)/);
});

test('production ownership migration scopes media writes to the uploader folder', async () => {
  const source = await read('../supabase/migrations/20261025065443_lock_listing_business_and_media_ownership_20261025.sql');
  assert.match(source, /DROP POLICY IF EXISTS "hardening_listings_update_institution"/);
  assert.match(source, /DROP POLICY IF EXISTS "hardening_listings_delete_institution"/);
  assert.match(source, /bucket_id='listing-media' AND \(storage\.foldername\(name\)\)\[1\]=\(SELECT auth\.uid\(\)\)::text/);
  assert.match(source, /bucket_id='profile-media' AND \(storage\.foldername\(name\)\)\[1\]=\(SELECT auth\.uid\(\)\)::text/);
});

test('administrator can read inactive listings needed for moderation', async () => {
  const source = await read('../supabase/migrations/20261025065643_allow_admin_visibility_for_listing_moderation_20261025.sql');
  assert.match(source, /FOR SELECT TO authenticated/);
  assert.match(source, /public\.is_admin\(\)/);
});

test('application pins the patched Next.js release and matching ESLint integration', async () => {
  const packageJson = JSON.parse(await read('../package.json'));
  assert.equal(packageJson.dependencies.next, '16.4.3');
  assert.equal(packageJson.devDependencies['eslint-config-next'], '16.4.3');
});

test('authenticated checkout is granted the order RPC while anonymous access stays denied', async () => {
  const sql = await read('../supabase/migrations/20261025080659_grant_authenticated_marketplace_order_rpc_20261025.sql');
  assert.match(sql, /revoke execute on function public\.create_marketplace_order\(\s*uuid,\s*integer,\s*text,\s*text,\s*text,\s*text,\s*text,\s*text,\s*text\s*\)\s+from public,\s*anon/i);
  assert.match(sql, /grant execute on function public\.create_marketplace_order\(\s*uuid,\s*integer,\s*text,\s*text,\s*text,\s*text,\s*text,\s*text,\s*text\s*\)\s+to authenticated/i);
});

test('database performance migration covers previously unindexed foreign keys', async () => {
  const sql = await read('../supabase/migrations/20261025081452_index_unindexed_foreign_keys_20261025.sql');
  assert.match(sql, /CREATE INDEX IF NOT EXISTS institution_code_aliases_institution_id_idx/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS manual_order_releases_admin_id_idx/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS payment_attempts_verified_by_idx/i);
});


test('community request inserts include the institution required by tenant RLS', async () => {
  const source = await read('../lib/community.ts');
  const start = source.indexOf('export async function createCommunityRequest(');
  const end = source.indexOf('export async function createCommunity(', start);
  assert.ok(start >= 0 && end > start, 'community request function should exist');
  const fn = source.slice(start, end);
  assert.match(fn, /getInstitutionIdForUser\(args\.userId\)/);
  assert.match(fn, /institution_id: institutionId/);
  assert.match(fn, /status: 'pending'/);
});

test('community and conversation policy migration preserves safe buyer/admin access', async () => {
  const sql = await read('../supabase/migrations/20261026041944_fix_everyday_marketplace_flows_20261026.sql');
  assert.match(sql, /users_can_request_communities/i);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /admins_can_delete_communities/i);
  assert.match(sql, /coalesce\(public\.is_admin\(\), false\)[\s\S]*institution_id = \(select private\.current_active_institution_id\(\)\)/i);
  assert.match(sql, /create or replace function public\.hide_conversation_for_user/i);
  assert.match(sql, /buyer_id = v_user_id or seller_id = v_user_id/i);
  assert.match(sql, /revoke all on function public\.hide_conversation_for_user\(uuid\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.hide_conversation_for_user\(uuid\) to authenticated/i);
});

test('saved listing control uses the account database instead of only local storage', async () => {
  const source = await read('../components/SaveListingButton.tsx');
  assert.match(source, /from\('saved_listings'\)/);
  assert.match(source, /\.insert\(\{ user_id: user\.id, listing_id: listingId \}\)/);
  assert.match(source, /\.delete\(\)/);
  assert.doesNotMatch(source, /campustrader-saved-listings/);
});

test('conversation hide is delegated to a participant-validated database RPC', async () => {
  const [source, migration] = await Promise.all([
    read('../lib/conversations.ts'),
    read('../supabase/migrations/20261026042206_hide_conversation_invoker_20261026.sql'),
  ]);
  const start = source.indexOf('export async function hideConversationForUser(');
  const end = source.indexOf('export async function sendMessage(', start);
  assert.ok(start >= 0 && end > start, 'conversation hide function should exist');
  const fn = source.slice(start, end);
  assert.match(fn, /supabase\.rpc\('hide_conversation_for_user'/);
  assert.doesNotMatch(fn, /\.update\(\{ hidden_for/);
  assert.match(migration, /alter function public\.hide_conversation_for_user\(uuid\) security invoker/i);
});

test('profile sync failures can retry and successful auth no longer waits on duplicate profile/session round trips', async () => {
  const [provider, signin] = await Promise.all([
    read('../components/AppProvider.tsx'),
    read('../app/signin/page.tsx'),
  ]);
  assert.match(provider, /const syncingProfileIds = new Set<string>\(\)/);
  assert.match(provider, /if \(error \|\| !profile\)[\s\S]*?syncedProfileIds\.delete\(userId\)/);
  assert.doesNotMatch(signin, /await ensureProfile\(/);
  assert.match(signin, /void refreshSession\(\)/);
});


test('new seller listings include the required listing_type and use the verified tenant ID', async () => {
  const source = await read('../lib/listings.ts');
  const start = source.indexOf('export async function insertListing(');
  const end = source.indexOf('export async function getListingById(', start);
  assert.ok(start >= 0 && end > start, 'insertListing function should exist');
  const fn = source.slice(start, end);
  assert.match(fn, /listing_type:\s*validated\.value\.condition === 'service'/);
  assert.match(fn, /institution_id:\s*institutionId/);
  assert.match(fn, /price:\s*validated\.value\.price == null \? null/);
});

test('listing schema migration allows contact-for-price listings without bypassing checkout safeguards', async () => {
  const [sql, orders] = await Promise.all([
    read('../supabase/migrations/20261026041944_fix_everyday_marketplace_flows_20261026.sql'),
    read('../lib/orders.ts'),
  ]);
  assert.match(sql, /alter table public\.listings alter column price drop not null/i);
  assert.match(orders, /Number\(listing\.price\) > 0/);
  assert.match(orders, /PHYSICAL_PRODUCT/);
});

test('auth signup trigger assigns campus from the institution instead of the table default', async () => {
  const sql = await read('../supabase/migrations/20261026041944_fix_everyday_marketplace_flows_20261026.sql');
  assert.match(sql, /set campus = case when upper\(i\.code\) = 'MUKIRIA TTI' then 'MUKIRIA' else i\.code end/i);
  assert.match(sql, /phone_number, campus,[\s\S]*v_phone, v_campus_code/);
});


test('legacy community request policy cannot bypass pending request restrictions', async () => {
  const sql = await read('../supabase/migrations/20261026042828_harden_community_request_policy_20261026.sql');
  assert.match(sql, /drop policy if exists "Verified users can submit pending communities"/i);
});


test('conversation history and hide remain available after listing deletion without widening participant access', async () => {
  const sql = await read('../supabase/migrations/20261026045000_recover_conversation_history_20261026.sql');
  assert.match(sql, /drop policy if exists hardening_conversations_institution/i);
  assert.match(sql, /buyer_id = \(select auth\.uid\(\)\) or seller_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /shares_current_active_institution\(buyer_id\)/i);
  assert.match(sql, /shares_current_active_institution\(seller_id\)/i);
  assert.doesNotMatch(sql, /using \([\s\S]*?exists \([\s\S]*?from public\.listings/i);
  assert.match(sql, /return found;/i);
  assert.match(sql, /grant execute on function public\.hide_conversation_for_user\(uuid\) to authenticated/i);
});
