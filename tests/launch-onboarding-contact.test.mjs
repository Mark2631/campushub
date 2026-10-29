import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('active listing seller contact is available without publishing non-seller phone numbers', async () => {
  const sql = await read('../supabase/migrations/20261027195500_seller_contact_phone_active_listings.sql');
  assert.match(sql, /l\.seller_id = p\.id AND l\.status = 'active'/);
  assert.match(sql, /THEN p\.phone_number ELSE NULL::text/);
});

test('WhatsApp routing normalizes Kenyan numbers and navigates on mobile browsers', async () => {
  const button = await read('../components/WhatsAppButton.tsx');
  assert.match(button, /normalizeKenyanPhone/);
  assert.match(button, /window\.location\.assign/);
  assert.doesNotMatch(button, /window\.open/);
});

test('new visitors see explicit View listing and onboarding steps', async () => {
  const card = await read('../components/ListingCard.tsx');
  const home = await read('../app/page.tsx');
  const profile = await read('../app/profile/page.tsx');
  assert.match(card, /View listing/);
  assert.match(home, /GettingStartedChecklist/);
  assert.doesNotMatch(profile, /<GettingStartedChecklist \/>/);
  assert.match(profile, /setupAction/);
  const setup = await read('../components/GettingStartedChecklist.tsx');
  assert.match(setup, /Dismiss CampusTrader setup/);
  assert.ok(setup.includes('/profile?setup=verification'));
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
  assert.match(order, /Orders coming soon/);
  assert.doesNotMatch(order, /OrderCheckoutForm/);
});
