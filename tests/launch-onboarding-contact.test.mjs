import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('public management contact is resolved from the configured active admin profile only', async () => {
  const sql = await read('../supabase/migrations/20261115060000_campustrader_management_contact.sql');
  assert.match(sql, /function public\.get_campustrader_whatsapp\(\)/i);
  assert.match(sql, /JOIN public\.profiles\s+AS p\s+ON LOWER\(p\.email\) = LOWER\(a\.email\)/i);
  assert.match(sql, /coalesce\(p\.account_status, 'active'\) = 'active'/i);
  assert.match(sql, /set search_path to ''/i);
  assert.match(sql, /revoke all on function public\.get_campustrader_whatsapp\(\) from public/i);
  assert.match(sql, /grant execute on function public\.get_campustrader_whatsapp\(\) to anon, authenticated/i);
});

test('WhatsApp enquiries always route to CampusTrader management with item context', async () => {
  const button = await read('../components/WhatsAppButton.tsx');
  const listing = await read('../app/listing/[id]/page.tsx');
  assert.match(button, /rpc\('get_campustrader_whatsapp'\)/);
  assert.match(button, /encodeURIComponent\(message\)/);
  assert.match(button, /window\.location\.assign/);
  assert.doesNotMatch(button, /get_listing_seller_whatsapp/);
  assert.match(listing, /<WhatsAppButton listingId=\{listing\.id\} listingTitle=\{listing\.title\}/);
});

test('product cards are descriptive and the catalogue uses a scrollable grid rather than product carousels', async () => {
  const card = await read('../components/ListingCard.tsx');
  const home = await read('../app/page.tsx');
  assert.match(card, /listing\.description/);
  assert.match(card, /View details/);
  assert.match(home, /grid-cols-2/);
  assert.match(home, /loadMore/);
  assert.doesNotMatch(home, /grid-flow-col/);
  assert.doesNotMatch(home, /ListingSection/);
});

test('ordering remains disabled during the managed-enquiry launch phase', async () => {
  const buy = await read('../components/BuyOrderButton.tsx');
  const order = await read('../app/orders/new/page.tsx');
  assert.match(buy, /disabled aria-disabled="true"/);
  assert.match(order, /Orders coming soon/);
  assert.doesNotMatch(order, /OrderCheckoutForm/);
});

test('verification file selection is displayed and not reset on selection', async () => {
  const profile = await read('../app/profile/page.tsx');
  const handler = profile.split('const handleDocumentChange =')[1]?.split('const handleVerificationSubmit =')[0] || '';
  assert.equal(handler.includes("event.currentTarget.value = ''"), false);
  assert.match(profile, /documentFiles\.length > 0/);
});
