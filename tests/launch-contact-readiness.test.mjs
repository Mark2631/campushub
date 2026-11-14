import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('buyer WhatsApp enquiries go to CampusTrader, not individual seller numbers', async () => {
  const migration = await read('../supabase/migrations/20261114090000_centralize_campustrader_whatsapp_contact.sql');
  const button = await read('../components/WhatsAppButton.tsx');
  const listing = await read('../app/listing/[id]/page.tsx');
  assert.match(migration, /get_campustrader_whatsapp/);
  assert.match(migration, /NULL::text AS phone_number/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_listing_seller_whatsapp\(uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(button, /rpc\('get_campustrader_whatsapp'/);
  assert.doesNotMatch(button, /get_listing_seller_whatsapp|phoneNumber/);
  assert.match(button, /encodeURIComponent\(message\)/);
  assert.match(listing, /listingTitle=\{listing\.title\}/);
});

test('catalogue cards support vertical browsing and expose product context', async () => {
  const home = await read('../app/page.tsx');
  const card = await read('../components/ListingCard.tsx');
  assert.match(home, /grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4/);
  assert.doesNotMatch(home, /grid-flow-col|auto-cols/);
  assert.match(card, /listing\.description/);
  assert.match(card, /View listing/);
});

test('ordering is disabled, listing cards give explicit view guidance', async () => {
  const buy = await read('../components/BuyOrderButton.tsx');
  const card = await read('../components/ListingCard.tsx');
  assert.match(buy, /disabled aria-disabled="true"/);
  assert.match(card, /View listing/);
});

test('verification file selection is displayed and not reset on selection', async () => {
  const profile = await read('../app/profile/page.tsx');
  const handler = profile.split('const handleDocumentChange =')[1]?.split('const handleVerificationSubmit =')[0] || '';
  assert.equal(handler.includes("event.currentTarget.value = ''"), false);
  assert.match(profile, /documentFiles\.length > 0/);
});
