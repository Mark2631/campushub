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
  const sql = await read('../supabase/migrations/20261025080400_grant_authenticated_marketplace_order_rpc_20261025.sql');
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.create_marketplace_order\(uuid, integer, text, text, text, text, text, text, text\) FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_marketplace_order\(uuid, integer, text, text, text, text, text, text, text\) TO authenticated/i);
});
