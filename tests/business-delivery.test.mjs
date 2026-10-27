import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('business profile creation sends both owner identities and the protected account institution', async () => {
  const source = await read('../lib/profiles.ts');
  const start = source.indexOf('export async function createBusinessProfile(');
  const end = source.indexOf('export async function getBusinessProfiles(', start);
  assert.ok(start >= 0 && end > start);
  const fn = source.slice(start, end);
  assert.match(fn, /getInstitutionIdForUser\(userId\)/);
  assert.match(fn, /owner_id: userId/);
  assert.match(fn, /user_id: userId/);
  assert.match(fn, /institution_id: institutionId/);
  assert.match(fn, /delivery_available: business\.delivery_available === true/);
  assert.doesNotMatch(fn, /legacyPayload/);
});

test('new business profile UI has an explicit delivery opt-in with no automatic booking claim', async () => {
  const source = await read('../app/profile/page.tsx');
  assert.match(source, /delivery_available: false/);
  assert.match(source, /Delivery can be arranged/);
  assert.match(source, /does not book a rider or take payment/);
});

test('public listing enrichment exposes only the business delivery flag needed by the listing page', async () => {
  const [listings, view] = await Promise.all([
    read('../lib/listings.ts'),
    read('../supabase/migrations/20261027103500_business_delivery_requests_20261027.sql'),
  ]);
  assert.match(listings, /businessDeliveryAvailable: Boolean\(business\?\.delivery_available\)/);
  assert.match(listings, /marketplace_businesses'[\s\S]*?delivery_available/);
  assert.match(view, /COALESCE\(delivery_available, false\) AS delivery_available/);
});

test('manual delivery requests are separately stored and protected by institution-scoped RLS', async () => {
  const [sql, button, adminQueue, adminPage] = await Promise.all([
    read('../supabase/migrations/20261027103500_business_delivery_requests_20261027.sql'),
    read('../components/DeliveryRequestButton.tsx'),
    read('../components/ManualDeliveryRequests.tsx'),
    read('../app/admin/page.tsx'),
  ]);
  assert.match(sql, /ALTER TABLE public\.delivery_service_requests ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /requester_id = \(SELECT auth\.uid\(\)\)/i);
  assert.match(sql, /private\.current_active_institution_id\(\)/i);
  assert.match(sql, /COALESCE\(public\.is_admin\(\), false\)/i);
  assert.match(button, /\.from\('delivery_service_requests'\)/);
  assert.match(button, /No rider has been booked and no payment has been made/);
  assert.match(adminQueue, /Private coordination notes/);
  assert.match(sql, /delivery_service_request_admin_notes_admin_select/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\\.delivery_service_request_admin_notes/);
  assert.match(adminPage, /tab === 'service-delivery' && <ManualDeliveryRequests \/>/);
});

test('manual delivery requests never call checkout or M-Pesa payment code', async () => {
  const button = await read('../components/DeliveryRequestButton.tsx');
  assert.doesNotMatch(button, /createMarketplaceOrder|submitManualPaymentReference|initiateMpesaPayment|requestMpesaPayment/i);
});
