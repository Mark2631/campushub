import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('admin contact RPC exposes only the intentional CampusTrader WhatsApp endpoint', async () => {
  const sql = await read('../supabase/migrations/20261115060000_campustrader_management_contact.sql');
  const button = await read('../components/WhatsAppButton.tsx');
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path to ''/i);
  assert.match(sql, /FROM public\.admins AS a/i);
  assert.match(sql, /JOIN public\.profiles AS p/i);
  assert.match(sql, /nullif\(btrim\(p\.phone_number\), ''\)/i);
  assert.match(button, /rpc\('get_campustrader_whatsapp'\)/);
  assert.doesNotMatch(button, /get_listing_seller_whatsapp/);
});

test('message-thread WhatsApp actions also go to management without reading seller phone numbers', async () => {
  const [page, conversations] = await Promise.all([
    read('../app/messages/[id]/page.tsx'),
    read('../lib/conversations.ts'),
  ]);
  assert.match(page, /WhatsAppButton listingId=\{conversation\.listingId\} listingTitle=\{conversation\.listingTitle\}/);
  assert.doesNotMatch(page, /otherUser\.phone_number/);
  assert.doesNotMatch(conversations, /select\('id, full_name, avatar_url, phone_number'\)/);
});

test('ordering is disabled and listing cards provide a clear way to open product details', async () => {
  const buy = await read('../components/BuyOrderButton.tsx');
  const card = await read('../components/ListingCard.tsx');
  assert.match(buy, /disabled aria-disabled="true"/);
  assert.match(card, /View details/);
});

test('verification file selection is displayed and not reset on selection', async () => {
  const profile = await read('../app/profile/page.tsx');
  const handler = profile.split('const handleDocumentChange =')[1]?.split('const handleVerificationSubmit =')[0] || '';
  assert.equal(handler.includes("event.currentTarget.value = ''"), false);
  assert.match(profile, /documentFiles\.length > 0/);
});
