import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('admin dashboard falls back when optional schema columns are missing', async () => {
  const admin = await read('../lib/admin.ts');
  assert.match(admin, /isMissingColumnError\(response\.error, 'verification_requests', 'request_type'\)/);
  assert.match(admin, /isMissingColumnError\(response\.error, 'profiles', 'phone_number'\)/);
  assert.match(admin, /isMissingColumnError\(response\.error, 'reports', 'details'\)/);
  assert.match(admin, /isMissingColumnError\(response\.error, 'listings', 'moderation_reason'\)/);
  assert.match(admin, /Could not load/);
});

test('admin dashboard includes item demand and targeted contact records', async () => {
  const admin = await read('../lib/admin.ts');
  const page = await read('../app/admin/page.tsx');
  assert.match(admin, /export interface AdminItemRequest/);
  assert.match(admin, /export interface AdminContact/);
  assert.match(admin, /from\('item_requests'\)/);
  assert.match(admin, /contactsResponse/);
  assert.match(admin, /\.in\('id', contactIds\)/);
  assert.match(page, /tab === 'requests'/);
  assert.match(page, /Buyer requests/);
  assert.match(page, /requester\?\.phone_number/);
  assert.match(page, /requester\?\.email/);
});

test('admin can see pending business records and their owners without public contact exposure', async () => {
  const admin = await read('../lib/admin.ts');
  const page = await read('../app/admin/page.tsx');
  const migration = await read('../supabase/migrations/20261115103000_managed_marketplace_and_conversations.sql');
  assert.match(admin, /owner_id/);
  assert.match(page, /ownerContact\?\.phone_number/);
  assert.match(page, /ownerContact\?\.email/);
  assert.match(page, /\['unverified', 'pending'\]\.includes\(business\.verification_status\)/);
  assert.match(migration, /CREATE POLICY ct_admin_businesses_read[\s\S]*?is_admin\(\)/i);
  assert.match(migration, /CREATE POLICY ct_admin_profile_contact_read[\s\S]*?is_admin\(\)/i);
  assert.match(migration, /CREATE POLICY ct_admin_item_requests_read[\s\S]*?is_admin\(\)/i);
});

test('seller phone lookup remains private while management contact remains public', async () => {
  const migration = await read('../supabase/migrations/20261115103000_managed_marketplace_and_conversations.sql');
  const button = await read('../components/WhatsAppButton.tsx');
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_listing_seller_whatsapp\(uuid\) FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_campustrader_whatsapp\(\) TO anon, authenticated/i);
  assert.match(button, /get_campustrader_whatsapp/);
  assert.doesNotMatch(button, /get_listing_seller_whatsapp/);
});
