import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('eligible product pages provide a real order-request path', async () => {
  const [listing, button, checkout] = await Promise.all([
    read('../app/listing/[id]/page.tsx'),
    read('../components/BuyOrderButton.tsx'),
    read('../app/orders/new/page.tsx'),
  ]);

  assert.match(listing, /listing\.status === 'active'[\s\S]*?listing\.listing_type === 'PHYSICAL_PRODUCT'/);
  assert.ok(button.includes('/orders/new?listing='));
  assert.match(checkout, /getListingById\(listingId\)/);
  assert.match(checkout, /isDirectPurchaseListing\(listing\)/);
  assert.match(checkout, /<OrderCheckoutForm/);
  assert.doesNotMatch(checkout, /Orders coming soon/);
});

test('orders route reuses the existing buyer and seller activity screen', async () => {
  const [route, activity, page] = await Promise.all([
    read('../app/orders/page.tsx'),
    read('../components/OrdersPageContent.tsx'),
    read('../components/OrdersActivity.tsx'),
  ]);

  assert.match(route, /OrdersPageContent initialView="buying"/);
  assert.match(activity, /<OrdersActivity userId=\{user\.id\} activeTab=\{activeTab\} \/>/);
  assert.match(page, /getMyOrders\(userId\)/);
  assert.match(page, /cancelMarketplaceOrder/);
  assert.match(page, /openOrderDispute/);
});

test('protected payment stays unavailable unless the server explicitly enables it', async () => {
  const checkout = await read('../components/OrderCheckoutForm.tsx');
  assert.match(checkout, /config\.payment_initiation_available === true/);
  assert.match(checkout, /\{protectedPaymentsReady \? \(/);
});

test('D-Delivery is presented as a request rather than a confirmed rider booking', async () => {
  const [checkout, readme] = await Promise.all([
    read('../components/OrderCheckoutForm.tsx'),
    read('../README.md'),
  ]);
  assert.match(checkout, /Request delivery to your campus location\./);
  assert.match(checkout, /\{canDeliver \? \(/);
  assert.match(readme, /a submitted request is not a confirmed booking/i);
  assert.match(readme, /does not provide automated rider matching, self-service rider onboarding, GPS tracking, or live ETAs/i);
});
