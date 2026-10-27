import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('seller WhatsApp lookup is scoped to active listings, not public profiles', async () => {
  const sql = await read('../supabase/migrations/20261027210000_active_listing_whatsapp_contact.sql');
  const button = await read('../components/WhatsAppButton.tsx');
  const listing = await read('../app/listing/[id]/page.tsx');
  assert.match(sql, /l\.status = 'active'/);
  assert.match(sql, /l\.deleted_at IS NULL/);
  assert.match(sql, /REVOKE ALL ON FUNCTION .* FROM PUBLIC/);
  assert.match(button, /rpc\('get_listing_seller_whatsapp'/);
  assert.match(button, /window\.location\.assign/);
  assert.match(listing, /<WhatsAppButton listingId=\{listing\.id\}/);
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
