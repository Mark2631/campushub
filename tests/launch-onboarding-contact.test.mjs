import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('seller phone numbers remain private while CampusTrader exposes its official contact', async () => {
  const sql = await read('../supabase/migrations/20261114090000_centralize_campustrader_whatsapp_contact.sql');
  assert.match(sql, /NULL::text AS phone_number/);
  assert.match(sql, /JOIN public\.profiles AS p\s+ON lower\(p\.email\) = lower\(a\.email\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_campustrader_whatsapp\(\) TO anon, authenticated/i);
});

test('WhatsApp routing normalizes Kenyan numbers and navigates on mobile browsers', async () => {
  const button = await read('../components/WhatsAppButton.tsx');
  assert.match(button, /normalizeKenyanPhone/);
  assert.match(button, /window\.location\.assign/);
  assert.match(button, /get_campustrader_whatsapp/);
  assert.doesNotMatch(button, /get_listing_seller_whatsapp|window\.open/);
});

test('first-time marketplace flow offers direct browse, sell and request actions', async () => {
  const card = await read('../components/ListingCard.tsx');
  const home = await read('../app/page.tsx');
  const profile = await read('../app/profile/page.tsx');
  assert.match(card, /View listing/);
  assert.doesNotMatch(home, /GettingStartedChecklist/);
  assert.match(home, /Browse items/);
  assert.match(home, /href="\/sell"/);
  assert.match(home, /href="\/sell\?mode=request"/);
  assert.match(home, /href="#marketplace-search"/);
  assert.match(home, /Contact CampusTrader/);
  assert.match(profile, /setupAction/);
});

test('verification selection persists in the file picker and displays selected count', async () => {
  const profile = await read('../app/profile/page.tsx');
  const filePickerHandler = profile.split('const handleDocumentChange =')[1]?.split('const handleVerificationSubmit =')[0] || '';
  assert.doesNotMatch(filePickerHandler, /event\.currentTarget\.value = ''/);
  assert.match(profile, /documentFiles\.length} document/);
});

test('order checkout is disabled during launch', async () => {
  const buy = await read('../components/BuyOrderButton.tsx');
  const order = await read('../app/orders/new/page.tsx');
  assert.match(buy, /disabled aria-disabled="true"/);
  assert.match(order, /Orders are being prepared/);
  assert.doesNotMatch(order, /OrderCheckoutForm/);
});
